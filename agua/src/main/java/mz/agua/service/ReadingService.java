package mz.agua.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.extern.slf4j.Slf4j;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Periods;
import mz.agua.common.Q;
import mz.agua.common.Text;
import mz.agua.domain.Account;
import mz.agua.domain.CompanySetting;
import mz.agua.domain.Invoice;
import mz.agua.domain.Meter;
import mz.agua.domain.Reading;
import mz.agua.dto.Dto;
import mz.agua.repository.AccountRepository;
import mz.agua.repository.InvoiceRepository;
import mz.agua.repository.MeterRepository;
import mz.agua.repository.ReadingRepository;
import mz.agua.security.CurrentUser;
import mz.agua.security.SessionUser;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Leituras de contadores (online, offline do telemóvel ou lançadas no escritório).
 * A leitura anterior vem SEMPRE do servidor; o client_uuid impede duplicados ao sincronizar.
 */
@Slf4j
@Service
public class ReadingService {

    private final ReadingRepository readings;
    private final AccountRepository accounts;
    private final MeterRepository meters;
    private final InvoiceRepository invoices;
    private final PricingService pricing;
    private final BillingService billing;
    private final AuditService audit;
    private final Db db;
    private final EntityManager em;
    private final TransactionTemplate perItem;

    public ReadingService(ReadingRepository readings, AccountRepository accounts, MeterRepository meters,
                          InvoiceRepository invoices, PricingService pricing, BillingService billing, AuditService audit,
                          Db db, EntityManager em, PlatformTransactionManager tm) {
        this.readings = readings;
        this.accounts = accounts;
        this.meters = meters;
        this.invoices = invoices;
        this.pricing = pricing;
        this.billing = billing;
        this.audit = audit;
        this.db = db;
        this.em = em;
        this.perItem = new TransactionTemplate(tm);
        this.perItem.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public Map<String, Object> list(Long cid, String q, String period, String status, Long readerId, Long accountId,
                                    Integer page, Integer size) {
        Q p = Q.company(cid).search(q).period(period).str("status", status).id("readerId", readerId)
                .id("accountId", accountId).paging(page, size);
        Map<String, Object> out = db.page("readings.list", p);
        String statsPeriod = period == null || period.isBlank() ? Periods.current() : period;
        out.put("stats", db.one("readings.stats", Q.company(cid).period(statsPeriod).map()));
        return out;
    }

    /** Regista uma leitura. source = online | offline | manual. Devolve a leitura e, se faturada, a fatura. */
    @Transactional
    public Map<String, Object> record(Long cid, Dto.Reading d, String source) {
        SessionUser me = CurrentUser.get();
        String uuid = Text.clean(d.clientUuid());
        if (uuid != null) {
            Reading existing = readings.findByClientUuid(uuid).orElse(null);
            if (existing != null) {
                if (!Objects.equals(existing.getCompanyId(), cid)) throw ApiException.conflict("Identificador de leitura repetido.");
                Map<String, Object> out = view(existing);
                out.put("duplicate", true);
                return out;
            }
        }
        CompanySetting s = pricing.settings(cid);
        if ("offline".equals(source) && !Boolean.TRUE.equals(s.getAllowOfflineReadings())) {
            throw ApiException.forbidden("A empresa não aceita leituras feitas sem internet.");
        }
        Account a = accounts.findById(d.accountId()).orElseThrow(() -> ApiException.notFound("Conta não encontrada."));
        if (!Objects.equals(a.getCompanyId(), cid)) throw ApiException.notFound("Conta não encontrada.");
        if (!"active".equals(a.getStatus())) throw ApiException.badRequest("A conta " + a.getNumber() + " não está ativa.");
        Meter m = meters.findFirstByAccountIdAndStatus(a.getId(), "active")
                .orElseThrow(() -> ApiException.badRequest("A conta " + a.getNumber() + " não tem contador ativo."));
        m = em.find(Meter.class, m.getId(), LockModeType.PESSIMISTIC_WRITE);   // uma leitura de cada vez por contador

        String period = Text.blank(d.period()) ? Periods.current() : Periods.validate(d.period().trim());
        LocalDateTime readAt = parseDateTime(d.readAt());
        if (readAt.isAfter(LocalDateTime.now().plusHours(1))) throw ApiException.badRequest("A data da leitura não pode ser no futuro.");
        int previous = previousValue(m.getId(), period, 0L);
        if (d.currentValue() < previous) {
            throw ApiException.badRequest("Leitura " + d.currentValue() + " menor que a anterior (" + previous + ") no contador "
                    + m.getNumber() + ". Verifique o número ou registe a troca de contador.");
        }
        Reading r = new Reading();
        r.setCompanyId(cid);
        r.setAccountId(a.getId());
        r.setMeterId(m.getId());
        r.setCustomerId(a.getCustomerId());
        r.setPeriod(period);
        r.setPreviousValue(previous);
        r.setCurrentValue(d.currentValue());
        r.setConsumption(d.currentValue() - previous);
        r.setReadAt(readAt);
        r.setStatus("pending");
        r.setSource(source);
        r.setClientUuid(uuid);
        r.setAnomaly(r.getConsumption() > (s.getConsumptionAlert() == null ? Integer.MAX_VALUE : s.getConsumptionAlert()));
        r.setNotes(Text.clean(d.notes()));
        r.setUserId(me.id());
        r = readings.saveAndFlush(r);           // índice único (contador + período) recusa a 2.ª leitura do mês
        audit.log("READING_CREATE", "readings/" + r.getId(), a.getNumber() + " " + period + " = " + r.getCurrentValue());

        Map<String, Object> out = view(r);
        boolean bill = Boolean.TRUE.equals(d.bill()) || Boolean.TRUE.equals(s.getAutoBill());
        if (bill) {
            Invoice i = billing.billReading(cid, r.getId());
            out.put("status", "billed");
            out.put("invoice_id", i.getId());
            out.put("invoice_number", i.getNumber());
            out.put("invoice_total", i.getTotal());
        }
        return out;
    }

    /** Envio em lote do modo offline: cada leitura numa transação, com resultado individual. */
    public List<Map<String, Object>> sync(Long cid, List<Dto.Reading> items) {
        if (items.size() > 500) throw ApiException.badRequest("Máximo de 500 leituras por envio.");
        List<Map<String, Object>> results = new ArrayList<>();
        for (Dto.Reading item : items) {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("client_uuid", item.clientUuid());
            try {
                if (item.accountId() == null || item.currentValue() == null || item.currentValue() < 0) {
                    throw ApiException.badRequest("Leitura incompleta.");
                }
                Map<String, Object> r = perItem.execute(st -> record(cid, item, "offline"));
                res.put("ok", true);
                res.put("reading", r);
            } catch (RuntimeException e) {
                res.put("ok", false);
                if (e instanceof ApiException) res.put("error", e.getMessage());
                else if (e instanceof DataIntegrityViolationException) res.put("error", "Este contador já tem leitura neste período.");
                else {
                    res.put("error", "Erro ao gravar a leitura.");
                    log.warn("Sincronização de leitura falhou", e);
                }
            }
            results.add(res);
        }
        return results;
    }

    /** Corrige uma leitura. Só a última de cada contador; se já faturada, a fatura é recalculada (sem pagamentos). */
    @Transactional
    public void edit(Long cid, Long id, Dto.ReadingEdit d) {
        Reading r = locked(cid, id);
        if ("cancelled".equals(r.getStatus())) throw ApiException.badRequest("Leitura anulada.");
        Long later = db.longValue("SELECT COUNT(*) FROM readings WHERE id_meter_reading = :m AND status_reading <> 'cancelled' "
                + "AND period_reading > :p", Map.of("m", r.getMeterId(), "p", r.getPeriod()));
        if (later != null && later > 0) throw ApiException.badRequest("Só pode corrigir a leitura mais recente do contador.");
        if (d.currentValue() < r.getPreviousValue()) {
            throw ApiException.badRequest("A leitura não pode ser menor que a anterior (" + r.getPreviousValue() + ").");
        }
        int old = r.getCurrentValue();
        r.setCurrentValue(d.currentValue());
        r.setConsumption(d.currentValue() - r.getPreviousValue());
        CompanySetting s = pricing.settings(cid);
        r.setAnomaly(r.getConsumption() > (s.getConsumptionAlert() == null ? Integer.MAX_VALUE : s.getConsumptionAlert()));
        if (d.notes() != null) r.setNotes(Text.clean(d.notes()));
        r.setEditedBy(CurrentUser.get().id());
        r.setEditedAt(LocalDateTime.now());
        readings.saveAndFlush(r);
        if ("billed".equals(r.getStatus())) billing.recalculate(cid, r);
        audit.log("READING_EDIT", "readings/" + id, old + " → " + d.currentValue());
    }

    /** Anula uma leitura pendente (ou faturada sem pagamentos: a fatura também é anulada). */
    @Transactional
    public void cancel(Long cid, Long id, String reason) {
        Reading r = locked(cid, id);
        if ("cancelled".equals(r.getStatus())) throw ApiException.badRequest("A leitura já está anulada.");
        if ("billed".equals(r.getStatus())) {
            Invoice i = invoices.findFirstByReadingIdAndStatusNot(r.getId(), "cancelled").orElse(null);
            if (i != null) billing.cancel(cid, i.getId(), "Leitura anulada: " + reason);
            r = locked(cid, id);
        }
        r.setStatus("cancelled");
        r.setNotes((r.getNotes() == null ? "" : r.getNotes() + "\n") + "Anulada: " + reason.trim());
        readings.save(r);
        audit.log("READING_CANCEL", "readings/" + id, reason);
    }

    private Reading locked(Long cid, Long id) {
        Reading r = em.find(Reading.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (r == null || !Objects.equals(r.getCompanyId(), cid)) throw ApiException.notFound("Leitura não encontrada.");
        return r;
    }

    private int previousValue(Long meterId, String period, Long exceptId) {
        Map<String, Object> row = db.one("meters.last_value", Q.of().id("meterId", meterId).str("period", period)
                .id("exceptId", exceptId).map());
        Long v = Db.lng(row, "value");
        return v == null ? 0 : v.intValue();
    }

    private static LocalDateTime parseDateTime(String v) {
        if (v == null || v.isBlank()) return LocalDateTime.now();
        String t = v.trim();
        try {
            if (t.endsWith("Z") || t.matches(".*[+-]\\d{2}:\\d{2}$")) {
                return OffsetDateTime.parse(t).atZoneSameInstant(java.time.ZoneId.systemDefault()).toLocalDateTime();
            }
            if (t.length() == 10) return java.time.LocalDate.parse(t).atTime(12, 0);
            return LocalDateTime.parse(t.length() > 19 ? t.substring(0, 19) : t);
        } catch (Exception e) {
            throw ApiException.badRequest("Data da leitura inválida.");
        }
    }

    static Map<String, Object> view(Reading r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("account_id", r.getAccountId());
        m.put("period", r.getPeriod());
        m.put("previous_value", r.getPreviousValue());
        m.put("current_value", r.getCurrentValue());
        m.put("consumption", r.getConsumption());
        m.put("status", r.getStatus());
        m.put("anomaly", r.getAnomaly());
        m.put("client_uuid", r.getClientUuid());
        return m;
    }
}
