package mz.agua.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Money;
import mz.agua.common.Periods;
import mz.agua.common.Q;
import mz.agua.common.Text;
import mz.agua.domain.Account;
import mz.agua.domain.CompanySetting;
import mz.agua.domain.Invoice;
import mz.agua.domain.Reading;
import mz.agua.dto.Dto;
import mz.agua.repository.AccountRepository;
import mz.agua.repository.InvoiceRepository;
import mz.agua.repository.ReadingRepository;
import mz.agua.security.CurrentUser;
import mz.agua.security.SessionUser;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Faturas: emissão a partir de leituras, faturas avulsas (ligação, multa, serviço…), anulação,
 * desconto e multas/juros automáticos. O estado (em aberto, parcial, paga, vencida) é recalculado
 * sempre que o valor ou o pagamento mudam.
 */
@Slf4j
@Service
public class BillingService {

    private final InvoiceRepository invoices;
    private final ReadingRepository readings;
    private final AccountRepository accounts;
    private final PricingService pricing;
    private final SequenceService seq;
    private final AuditService audit;
    private final Db db;
    private final EntityManager em;
    private final TransactionTemplate perItem;
    private final ApplicationEventPublisher events;

    public BillingService(InvoiceRepository invoices, ReadingRepository readings, AccountRepository accounts,
                          PricingService pricing, SequenceService seq, AuditService audit, Db db, EntityManager em,
                          PlatformTransactionManager tm, ApplicationEventPublisher events) {
        this.events = events;
        this.invoices = invoices;
        this.readings = readings;
        this.accounts = accounts;
        this.pricing = pricing;
        this.seq = seq;
        this.audit = audit;
        this.db = db;
        this.em = em;
        this.perItem = new TransactionTemplate(tm);
        this.perItem.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ---------------- Consultas ----------------
    public Map<String, Object> list(Long cid, String q, String period, String status, Long customerId, Long accountId,
                                    String from, String to, Integer page, Integer size) {
        Q p = Q.company(cid).search(q).period(period).str("status", status).id("customerId", customerId)
                .id("accountId", accountId).dates(from, to).paging(page, size);
        Map<String, Object> out = db.page("invoices.list", p);
        out.put("stats", db.one("invoices.stats", Q.company(cid).period(period).map()));
        return out;
    }

    public Map<String, Object> detail(Long cid, Long id) {
        Q p = Q.company(cid).id("id", id);
        Map<String, Object> inv = db.require("invoices.detail", p.map(), "Fatura não encontrada.");
        inv.put("payments", db.list("invoices.payments", p.map()));
        return inv;
    }

    // ---------------- Emissão ----------------
    /** Fatura uma leitura pendente (chamado pela leitura com faturação automática ou pelo gestor). */
    @Transactional
    public Invoice billReading(Long cid, Long readingId) {
        Reading r = em.find(Reading.class, readingId, LockModeType.PESSIMISTIC_WRITE);
        if (r == null || !Objects.equals(r.getCompanyId(), cid)) throw ApiException.notFound("Leitura não encontrada.");
        if (!"pending".equals(r.getStatus())) throw ApiException.badRequest("Esta leitura já foi faturada ou anulada.");
        Account a = accounts.findById(r.getAccountId()).orElseThrow(() -> ApiException.notFound("Conta não encontrada."));
        CompanySetting s = pricing.settings(cid);
        TariffCalculator.Result price = pricing.price(s, r.getConsumption(), a.getCategory());

        Invoice i = new Invoice();
        i.setCompanyId(cid);
        i.setCustomerId(r.getCustomerId());
        i.setAccountId(r.getAccountId());
        i.setReadingId(r.getId());
        i.setKind("consumption");
        i.setNumber(seq.invoiceNumber(cid, s.getInvoicePrefix()));
        i.setPeriod(r.getPeriod());
        i.setPreviousValue(r.getPreviousValue());
        i.setCurrentValue(r.getCurrentValue());
        i.setConsumption(r.getConsumption());
        setAmounts(i, price);
        i.setIssueDate(LocalDate.now());
        i.setDueDate(LocalDate.now().plusDays(s.getInvoiceDueDays()));
        i.setUserId(CurrentUser.optional().map(SessionUser::id).orElse(null));
        refreshStatus(i);
        i = invoices.saveAndFlush(i);

        r.setStatus("billed");
        readings.save(r);
        audit.log("INVOICE_CREATE", "invoices/" + i.getId(), i.getNumber() + " " + i.getTotal());
        events.publishEvent(new MessageEvents.InvoiceIssued(cid, i.getId()));   // aviso por WhatsApp/SMS (se ativo)
        return i;
    }

    /** Fatura todas as leituras pendentes do período. Cada leitura numa transação: um erro não bloqueia as outras. */
    public Map<String, Object> billPeriod(Long cid, String period) {
        List<Map<String, Object>> ids = db.list("readings.pending_ids", Q.company(cid).period(period).map());
        int ok = 0;
        List<String> errors = new ArrayList<>();
        for (Map<String, Object> row : ids) {
            Long id = Db.lng(row, "id");
            try {
                perItem.executeWithoutResult(st -> billReading(cid, id));
                ok++;
            } catch (RuntimeException e) {
                errors.add("Leitura " + id + ": " + e.getMessage());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("billed", ok);
        out.put("errors", errors);
        return out;
    }

    /** Fatura avulsa (taxa de ligação, religação, multa, serviço…) numa conta. */
    @Transactional
    public Invoice createManual(Long cid, Dto.ManualInvoice d) {
        Account a = accounts.findById(d.accountId()).orElseThrow(() -> ApiException.notFound("Conta não encontrada."));
        if (!Objects.equals(a.getCompanyId(), cid)) throw ApiException.notFound("Conta não encontrada.");
        CompanySetting s = pricing.settings(cid);
        Invoice i = new Invoice();
        i.setCompanyId(cid);
        i.setCustomerId(a.getCustomerId());
        i.setAccountId(a.getId());
        i.setKind("manual");
        i.setNumber(seq.invoiceNumber(cid, s.getInvoicePrefix()));
        i.setPeriod(Text.blank(d.period()) ? Periods.current() : Periods.validate(d.period().trim()));
        i.setDescription(d.description().trim());
        i.setConsumption(0);
        i.setOtherAmount(Money.of(d.amount()));
        i.setTotal(Money.of(d.amount()));
        i.setIssueDate(LocalDate.now());
        LocalDate due = CustomerService.parseDate(d.dueDate(), "Data de vencimento inválida.");
        i.setDueDate(due == null ? LocalDate.now().plusDays(s.getInvoiceDueDays()) : due);
        if (i.getDueDate().isBefore(i.getIssueDate())) throw ApiException.badRequest("O vencimento não pode ser antes da emissão.");
        i.setNotes(Text.clean(d.notes()));
        i.setUserId(CurrentUser.optional().map(SessionUser::id).orElse(null));
        refreshStatus(i);
        i = invoices.saveAndFlush(i);
        audit.log("INVOICE_MANUAL", "invoices/" + i.getId(), i.getNumber() + " " + i.getTotal());
        events.publishEvent(new MessageEvents.InvoiceIssued(cid, i.getId()));
        return i;
    }

    /** Leitura corrigida: recalcula a fatura (só se ainda não tem pagamentos). */
    @Transactional
    public void recalculate(Long cid, Reading r) {
        Invoice i = invoices.findFirstByReadingIdAndStatusNot(r.getId(), "cancelled").orElse(null);
        if (i == null) return;
        i = em.find(Invoice.class, i.getId(), LockModeType.PESSIMISTIC_WRITE);
        if (i.getPaidAmount().signum() > 0) {
            throw ApiException.badRequest("A fatura " + i.getNumber() + " já tem pagamentos. Anule os pagamentos antes de corrigir a leitura.");
        }
        Account a = accounts.findById(r.getAccountId()).orElseThrow(() -> ApiException.notFound("Conta não encontrada."));
        TariffCalculator.Result price = pricing.price(cid, r.getConsumption(), a.getCategory());
        i.setPreviousValue(r.getPreviousValue());
        i.setCurrentValue(r.getCurrentValue());
        i.setConsumption(r.getConsumption());
        i.setFineAmount(BigDecimal.ZERO);
        i.setInterestAmount(BigDecimal.ZERO);
        i.setLastChargeDate(null);
        setAmounts(i, price);
        refreshStatus(i);
        invoices.save(i);
        audit.log("INVOICE_RECALCULATE", "invoices/" + i.getId(), i.getNumber() + " " + i.getTotal());
    }

    private static void setAmounts(Invoice i, TariffCalculator.Result price) {
        i.setWaterAmount(price.water());
        i.setSewerAmount(price.sewer());
        i.setFixedFee(price.fixedFee());
        i.setTotal(total(i));
    }

    /** Total = água + saneamento + taxa fixa + outros + multa + juros − desconto. */
    static BigDecimal total(Invoice i) {
        return Money.of(Money.nz(i.getWaterAmount()).add(Money.nz(i.getSewerAmount())).add(Money.nz(i.getFixedFee()))
                .add(Money.nz(i.getOtherAmount())).add(Money.nz(i.getFineAmount())).add(Money.nz(i.getInterestAmount()))
                .subtract(Money.nz(i.getDiscount())));
    }

    /** Estado a partir dos valores: paga · vencida · parcial · em aberto (anulada nunca muda). */
    public static void refreshStatus(Invoice i) {
        if ("cancelled".equals(i.getStatus())) return;
        BigDecimal balance = Money.nz(i.getTotal()).subtract(Money.nz(i.getPaidAmount()));
        if (balance.signum() <= 0) {
            i.setStatus("paid");
            if (i.getPaidAt() == null) i.setPaidAt(LocalDate.now());
        } else {
            i.setPaidAt(null);
            if (i.getDueDate() != null && i.getDueDate().isBefore(LocalDate.now())) i.setStatus("overdue");
            else if (Money.nz(i.getPaidAmount()).signum() > 0) i.setStatus("partial");
            else i.setStatus("open");
        }
    }

    // ---------------- Alterações ----------------
    @Transactional
    public void cancel(Long cid, Long id, String reason) {
        Invoice i = locked(cid, id);
        if ("cancelled".equals(i.getStatus())) throw ApiException.badRequest("A fatura já está anulada.");
        if (i.getPaidAmount().signum() > 0) {
            throw ApiException.badRequest("A fatura tem pagamentos. Anule primeiro os pagamentos (Pagamentos → Apagar).");
        }
        i.setStatus("cancelled");
        i.setCancelReason(reason.trim());
        invoices.save(i);
        if (i.getReadingId() != null) {
            readings.findById(i.getReadingId()).ifPresent(r -> {
                r.setStatus("pending");          // a leitura volta a poder ser corrigida/faturada
                readings.save(r);
            });
        }
        audit.log("INVOICE_CANCEL", "invoices/" + id, i.getNumber() + ": " + reason);
    }

    @Transactional
    public void discount(Long cid, Long id, BigDecimal amount, String reason) {
        Invoice i = locked(cid, id);
        if ("cancelled".equals(i.getStatus())) throw ApiException.badRequest("Fatura anulada.");
        BigDecimal balance = i.getTotal().subtract(i.getPaidAmount());
        if (amount.compareTo(balance) > 0) throw ApiException.badRequest("O desconto não pode ser maior que o saldo (" + balance + ").");
        i.setDiscount(Money.of(Money.nz(i.getDiscount()).add(amount)));
        i.setTotal(total(i));
        String note = "Desconto " + amount + ": " + reason.trim();
        i.setNotes(i.getNotes() == null ? note : i.getNotes() + "\n" + note);
        refreshStatus(i);
        invoices.save(i);
        audit.log("INVOICE_DISCOUNT", "invoices/" + id, note);
    }

    private Invoice locked(Long cid, Long id) {
        Invoice i = em.find(Invoice.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (i == null || !Objects.equals(i.getCompanyId(), cid)) throw ApiException.notFound("Fatura não encontrada.");
        return i;
    }

    // ---------------- Multas e juros ----------------
    /** Todos os dias às 00:30 (fuso de app.timezone): multas/juros das faturas vencidas de todas as empresas. */
    @Scheduled(cron = "0 30 0 * * *", zone = "${app.timezone:Africa/Maputo}")
    public void applyLateChargesAll() {
        int n = applyLateCharges(0L);
        log.info("Multas e juros atualizados em {} faturas", n);
    }

    public int applyLateCharges(Long cid) {
        List<Map<String, Object>> ids = db.list("invoices.overdue_for_charges", Q.of().id("cid", cid).map());
        int changed = 0;
        for (Map<String, Object> row : ids) {
            Long id = Db.lng(row, "id");
            try {
                Boolean c = perItem.execute(st -> applyLateCharge(id));
                if (Boolean.TRUE.equals(c)) changed++;
            } catch (RuntimeException e) {
                log.warn("Multa/juros da fatura {}: {}", id, e.getMessage());
            }
        }
        return changed;
    }

    private boolean applyLateCharge(Long id) {
        Invoice i = em.find(Invoice.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (i == null || "cancelled".equals(i.getStatus())) return false;
        CompanySetting s = pricing.settings(i.getCompanyId());
        BigDecimal base = Money.nz(i.getWaterAmount()).add(Money.nz(i.getSewerAmount())).add(Money.nz(i.getFixedFee()))
                .add(Money.nz(i.getOtherAmount())).subtract(Money.nz(i.getDiscount()));
        LateChargeCalculator.Charges ch = LateChargeCalculator.calculate(base, i.getDueDate(), LocalDate.now(),
                new LateChargeCalculator.Rules(Boolean.TRUE.equals(s.getFineEnabled()), s.getFineType(), s.getFineValue(),
                        s.getFineGraceDays(), Boolean.TRUE.equals(s.getInterestEnabled()), s.getInterestMonthlyPercent()));
        boolean changed = ch.fine().compareTo(Money.nz(i.getFineAmount())) != 0
                || ch.interest().compareTo(Money.nz(i.getInterestAmount())) != 0;
        i.setFineAmount(ch.fine());
        i.setInterestAmount(ch.interest());
        i.setTotal(total(i));
        i.setLastChargeDate(LocalDate.now());
        refreshStatus(i);
        invoices.save(i);
        return changed;
    }
}
