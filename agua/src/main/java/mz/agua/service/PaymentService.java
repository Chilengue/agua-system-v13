package mz.agua.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.extern.slf4j.Slf4j;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Money;
import mz.agua.common.Q;
import mz.agua.common.Text;
import mz.agua.domain.CompanySetting;
import mz.agua.domain.Customer;
import mz.agua.domain.Invoice;
import mz.agua.domain.Payment;
import mz.agua.domain.PaymentAllocation;
import mz.agua.dto.Dto;
import mz.agua.repository.CustomerRepository;
import mz.agua.repository.InvoiceRepository;
import mz.agua.repository.PaymentAllocationRepository;
import mz.agua.repository.PaymentRepository;
import mz.agua.security.CurrentUser;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Pagamentos. Um cliente pode pagar qualquer valor até à dívida (pagar aos poucos):
 * fatura de 300 → paga 100 (fica 200) → paga 250 (200 liquidam esta fatura e 50 vão para a seguinte).
 * O valor é aplicado às faturas mais antigas primeiro, ou só às faturas escolhidas.
 * Apagar um pagamento = anular com motivo (as faturas voltam a ter o saldo; o recibo fica no histórico).
 */
@Slf4j
@Service
public class PaymentService {

    private static final Set<String> NEED_REFERENCE = Set.of("mpesa", "emola", "mkesh", "bank", "card");

    private final PaymentRepository payments;
    private final PaymentAllocationRepository allocations;
    private final InvoiceRepository invoices;
    private final CustomerRepository customers;
    private final PricingService pricing;
    private final SequenceService seq;
    private final SettingsService settings;
    private final AuditService audit;
    private final Db db;
    private final EntityManager em;
    private final TransactionTemplate perItem;
    private final ApplicationEventPublisher events;

    public PaymentService(PaymentRepository payments, PaymentAllocationRepository allocations, InvoiceRepository invoices,
                          CustomerRepository customers, PricingService pricing, SequenceService seq,
                          SettingsService settings, AuditService audit, Db db, EntityManager em,
                          PlatformTransactionManager tm, ApplicationEventPublisher events) {
        this.events = events;
        this.payments = payments;
        this.allocations = allocations;
        this.invoices = invoices;
        this.customers = customers;
        this.pricing = pricing;
        this.seq = seq;
        this.settings = settings;
        this.audit = audit;
        this.db = db;
        this.em = em;
        this.perItem = new TransactionTemplate(tm);
        this.perItem.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ---------------- Consultas ----------------
    public Map<String, Object> list(Long cid, String q, String status, String method, Long customerId,
                                    String from, String to, Integer page, Integer size) {
        Q p = Q.company(cid).search(q).str("status", status).str("method", method).id("customerId", customerId)
                .dates(from, to).paging(page, size);
        Map<String, Object> out = db.page("payments.list", p);
        out.put("stats", db.one("payments.stats", Q.company(cid).dates(from, to).map()));
        return out;
    }

    /** Dívida do cliente para a caixa: faturas em aberto (de uma conta ou de todas), das mais antigas às mais recentes. */
    public Map<String, Object> openInvoices(Long cid, Long customerId, Long accountId) {
        Customer c = customer(cid, customerId);
        List<Map<String, Object>> list = db.list("invoices.open_for_customer",
                Q.company(cid).id("customerId", customerId).id("accountId", accountId).map());
        BigDecimal total = list.stream().map(r -> Db.dec(r, "balance")).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("customer_id", c.getId());
        out.put("customer_code", c.getCode());
        out.put("customer_name", c.getName());
        out.put("phone", c.getPhone());
        out.put("invoices", list);
        out.put("total_debt", total);
        return out;
    }

    public Map<String, Object> detail(Long cid, Long id) {
        Q p = Q.company(cid).id("id", id);
        Map<String, Object> pay = db.require("payments.detail", p.map(), "Pagamento não encontrado.");
        pay.put("allocations", db.list("payments.allocations", p.map()));
        return pay;
    }

    /** Dados completos do recibo: empresa (logótipo, morada, regras do recibo), cliente, faturas pagas e leituras. */
    public Map<String, Object> receipt(Long cid, Long id) {
        Map<String, Object> out = detail(cid, id);
        out.put("company", settings.branding(cid));
        return out;
    }

    // ---------------- Registar ----------------
    @Transactional
    public Map<String, Object> pay(Long cid, Dto.Payment d, boolean offline) {
        String uuid = Text.clean(d.clientUuid());
        if (uuid != null) {
            Payment existing = payments.findByClientUuid(uuid).orElse(null);
            if (existing != null) {
                if (!Objects.equals(existing.getCompanyId(), cid)) throw ApiException.conflict("Identificador de pagamento repetido.");
                Map<String, Object> out = view(existing);
                out.put("duplicate", true);
                return out;
            }
        }
        Customer c = customer(cid, d.customerId());
        BigDecimal amount = Money.of(d.amount());
        if (amount.signum() <= 0) throw ApiException.badRequest("O valor deve ser maior que zero.");
        String reference = Text.clean(d.reference());
        if (NEED_REFERENCE.contains(d.method()) && reference == null) {
            throw ApiException.badRequest("Indique a referência da transação (" + d.method().toUpperCase() + ").");
        }
        CompanySetting s = pricing.settings(cid);

        // faturas a liquidar, bloqueadas até ao fim (duas caixas não pagam a mesma fatura ao mesmo tempo)
        List<Map<String, Object>> open = db.list("invoices.open_for_customer",
                Q.company(cid).id("customerId", c.getId()).id("accountId", d.accountId()).map());
        Set<Long> chosen = d.invoiceIds() == null || d.invoiceIds().isEmpty() ? null : new HashSet<>(d.invoiceIds());
        List<Invoice> targets = new ArrayList<>();
        BigDecimal due = BigDecimal.ZERO;
        for (Map<String, Object> row : open) {
            Long invoiceId = Db.lng(row, "id");
            if (chosen != null && !chosen.contains(invoiceId)) continue;
            Invoice i = em.find(Invoice.class, invoiceId, LockModeType.PESSIMISTIC_WRITE);
            BigDecimal balance = i.getTotal().subtract(i.getPaidAmount());
            if ("cancelled".equals(i.getStatus()) || balance.signum() <= 0) continue;
            targets.add(i);
            due = due.add(balance);
        }
        if (targets.isEmpty()) throw ApiException.badRequest("O cliente não tem faturas em dívida" + (chosen == null ? "." : " nas faturas escolhidas."));
        if (amount.compareTo(due) > 0) {
            throw ApiException.badRequest("O valor (" + amount + ") é maior que a dívida (" + due + " " + s.getCurrency() + ").");
        }

        boolean needsValidation = Boolean.TRUE.equals(s.getRequirePaymentValidation()) && !"cash".equals(d.method());
        Payment p = new Payment();
        p.setCompanyId(cid);
        p.setCustomerId(c.getId());
        p.setReceiptNumber(seq.receiptNumber(cid, s.getReceiptPrefix()));
        p.setAmount(amount);
        p.setMethod(d.method());
        p.setReference(reference);
        p.setPaidAt(paidAt(d.paidAt()));
        p.setClientUuid(uuid);
        p.setStatus(needsValidation ? "pending" : "confirmed");
        String notes = Text.clean(d.notes());
        p.setNotes(offline ? (notes == null ? "Registado sem internet" : notes + " · Registado sem internet") : notes);
        p.setUserId(CurrentUser.get().id());
        if (!needsValidation) {
            p.setValidatedAt(LocalDateTime.now());
            p.setValidatedBy(p.getUserId());
        }
        p = payments.saveAndFlush(p);

        BigDecimal left = amount;
        for (Invoice i : targets) {
            if (left.signum() <= 0) break;
            BigDecimal balance = i.getTotal().subtract(i.getPaidAmount());
            BigDecimal part = left.min(balance);
            PaymentAllocation a = new PaymentAllocation();
            a.setCompanyId(cid);
            a.setPaymentId(p.getId());
            a.setInvoiceId(i.getId());
            a.setAccountId(i.getAccountId());
            a.setAmount(part);
            a.setBalanceBefore(balance);
            a.setBalanceAfter(balance.subtract(part));
            allocations.save(a);
            if (!needsValidation) applyTo(i, part);
            left = left.subtract(part);
        }
        audit.log("PAYMENT_CREATE", "payments/" + p.getId(), p.getReceiptNumber() + " " + amount + " " + d.method());
        if (!needsValidation) events.publishEvent(new MessageEvents.PaymentConfirmed(cid, p.getId()));   // recibo por WhatsApp/SMS
        Map<String, Object> out = view(p);
        out.put("needs_validation", needsValidation);
        return out;
    }

    /** Envio dos pagamentos registados na caixa sem internet (cada um numa transação). */
    public List<Map<String, Object>> sync(Long cid, List<Dto.Payment> items) {
        if (items.size() > 200) throw ApiException.badRequest("Máximo de 200 pagamentos por envio.");
        List<Map<String, Object>> results = new ArrayList<>();
        for (Dto.Payment item : items) {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("client_uuid", item.clientUuid());
            try {
                if (item.customerId() == null || item.amount() == null || item.method() == null) {
                    throw ApiException.badRequest("Pagamento incompleto.");
                }
                res.put("payment", perItem.execute(st -> pay(cid, item, true)));
                res.put("ok", true);
            } catch (RuntimeException e) {
                res.put("ok", false);
                if (e instanceof ApiException) res.put("error", e.getMessage());
                else if (e instanceof DataIntegrityViolationException) res.put("error", "Pagamento já recebido.");
                else {
                    res.put("error", "Erro ao gravar o pagamento.");
                    log.warn("Sincronização de pagamento falhou", e);
                }
            }
            results.add(res);
        }
        return results;
    }

    // ---------------- Validar / anular ----------------
    @Transactional
    public void validate(Long cid, Long id) {
        Payment p = locked(cid, id);
        if (!"pending".equals(p.getStatus())) throw ApiException.badRequest("Este pagamento não está pendente de validação.");
        for (PaymentAllocation a : allocations.findByPaymentIdOrderByIdAsc(p.getId())) {
            Invoice i = em.find(Invoice.class, a.getInvoiceId(), LockModeType.PESSIMISTIC_WRITE);
            BigDecimal balance = i.getTotal().subtract(i.getPaidAmount());
            if ("cancelled".equals(i.getStatus()) || a.getAmount().compareTo(balance) > 0) {
                throw ApiException.badRequest("A fatura " + i.getNumber() + " já não tem saldo para este pagamento. "
                        + "Anule este pagamento e registe-o de novo.");
            }
            a.setBalanceBefore(balance);
            a.setBalanceAfter(balance.subtract(a.getAmount()));
            allocations.save(a);
            applyTo(i, a.getAmount());
        }
        p.setStatus("confirmed");
        p.setValidatedBy(CurrentUser.get().id());
        p.setValidatedAt(LocalDateTime.now());
        payments.save(p);
        audit.log("PAYMENT_VALIDATE", "payments/" + id, p.getReceiptNumber());
        events.publishEvent(new MessageEvents.PaymentConfirmed(cid, p.getId()));
    }

    @Transactional
    public void voidPayment(Long cid, Long id, String reason) {
        Payment p = locked(cid, id);
        if ("voided".equals(p.getStatus())) throw ApiException.badRequest("O pagamento já está anulado.");
        if ("confirmed".equals(p.getStatus())) {
            for (PaymentAllocation a : allocations.findByPaymentIdOrderByIdAsc(p.getId())) {
                Invoice i = em.find(Invoice.class, a.getInvoiceId(), LockModeType.PESSIMISTIC_WRITE);
                BigDecimal paid = i.getPaidAmount().subtract(a.getAmount());
                i.setPaidAmount(paid.signum() < 0 ? BigDecimal.ZERO.setScale(2) : paid);
                BillingService.refreshStatus(i);
                invoices.save(i);
            }
        }
        p.setStatus("voided");
        p.setVoidReason(reason.trim());
        p.setVoidedBy(CurrentUser.get().id());
        p.setVoidedAt(LocalDateTime.now());
        payments.save(p);
        audit.log("PAYMENT_VOID", "payments/" + id, p.getReceiptNumber() + " " + p.getAmount() + ": " + reason);
    }

    private void applyTo(Invoice i, BigDecimal part) {
        i.setPaidAmount(Money.of(i.getPaidAmount().add(part)));
        BillingService.refreshStatus(i);
        invoices.save(i);
    }

    private Payment locked(Long cid, Long id) {
        Payment p = em.find(Payment.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (p == null || !Objects.equals(p.getCompanyId(), cid)) throw ApiException.notFound("Pagamento não encontrado.");
        return p;
    }

    private Customer customer(Long cid, Long id) {
        Customer c = customers.findById(id).orElseThrow(() -> ApiException.notFound("Cliente não encontrado."));
        if (!Objects.equals(c.getCompanyId(), cid)) throw ApiException.notFound("Cliente não encontrado.");
        return c;
    }

    private static LocalDateTime paidAt(String v) {
        if (v == null || v.isBlank()) return LocalDateTime.now();
        try {
            String t = v.trim();
            LocalDateTime dt = t.length() == 10 ? LocalDate.parse(t).atTime(LocalDateTime.now().toLocalTime().withNano(0))
                    : LocalDateTime.parse(t.length() > 19 ? t.substring(0, 19) : t);
            if (dt.isAfter(LocalDateTime.now().plusHours(1))) throw ApiException.badRequest("A data do pagamento não pode ser no futuro.");
            return dt;
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.badRequest("Data do pagamento inválida.");
        }
    }

    static Map<String, Object> view(Payment p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("receipt_number", p.getReceiptNumber());
        m.put("amount", p.getAmount());
        m.put("status", p.getStatus());
        m.put("client_uuid", p.getClientUuid());
        return m;
    }
}
