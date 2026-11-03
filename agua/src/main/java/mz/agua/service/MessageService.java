package mz.agua.service;

import lombok.extern.slf4j.Slf4j;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Q;
import mz.agua.common.Text;
import mz.agua.domain.Company;
import mz.agua.domain.CompanySetting;
import mz.agua.domain.Message;
import mz.agua.dto.Dto;
import mz.agua.repository.CompanyRepository;
import mz.agua.repository.MessageRepository;
import mz.agua.security.CurrentUser;
import mz.agua.security.Plans;
import mz.agua.security.SessionUser;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Mensagens aos clientes por WhatsApp (planos Standard e Enterprise) e SMS (Enterprise):
 * aviso de fatura, recibo de pagamento, lembrete de dívida e mensagem livre.
 * <p>
 * Com API configurada (WhatsApp Cloud ou gateway de SMS) a mensagem vai para a fila e é enviada sozinha.
 * Sem API fica "por abrir": o operador toca em "Abrir" e o WhatsApp/SMS do telemóvel abre com o texto pronto.
 */
@Slf4j
@Service
public class MessageService {

    public static final String DEFAULT_INVOICE = "Olá {cliente}. {empresa}: a fatura {fatura} de {mes} (conta {conta}) já está disponível. "
            + "Leitura {leitura_anterior} → {leitura_atual} = {consumo} m³. Valor a pagar: {valor}, até {vencimento}. Dívida total: {divida}.";
    public static final String DEFAULT_PAYMENT = "Olá {cliente}. {empresa} confirma o pagamento de {pago} em {data} (recibo {recibo}). "
            + "Dívida atual: {divida}. Obrigado!";
    public static final String DEFAULT_REMINDER = "Olá {cliente}. {empresa} lembra que tem {faturas} fatura(s) de água por pagar, "
            + "no total de {divida}. {como_pagar}";

    private final MessageRepository messages;
    private final CompanyRepository companies;
    private final PricingService pricing;
    private final MessageGateway gateway;
    private final AuditService audit;
    private final Db db;
    private final TransactionTemplate tx;

    public MessageService(MessageRepository messages, CompanyRepository companies, PricingService pricing,
                          MessageGateway gateway, AuditService audit, Db db, PlatformTransactionManager tm) {
        this.messages = messages;
        this.companies = companies;
        this.pricing = pricing;
        this.gateway = gateway;
        this.audit = audit;
        this.db = db;
        this.tx = new TransactionTemplate(tm);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ---------------- Consultas ----------------
    public Map<String, Object> list(Long cid, String q, String status, String channel, String kind, String from, String to,
                                    Integer page, Integer size) {
        requireMessaging(cid);
        Map<String, Object> out = db.page("messages.list", Q.company(cid).search(q).str("status", status)
                .str("channel", channel).str("kind", kind).dates(from, to).paging(page, size));
        out.put("stats", db.one("messages.stats", Q.company(cid).dates(from, to).map()));
        return out;
    }

    // ---------------- Preparar / enviar ----------------
    /** Aviso de uma fatura ao cliente. */
    @Transactional
    public Map<String, Object> forInvoice(Long cid, Long invoiceId, String channel) {
        Company c = company(cid);
        Plans.require(c.getPlan(), channel);
        Map<String, Object> m = invoiceMessage(c, invoiceId, channel);
        return sendNow(m);
    }

    /** Recibo de um pagamento ao cliente. */
    @Transactional
    public Map<String, Object> forPayment(Long cid, Long paymentId, String channel) {
        Company c = company(cid);
        Plans.require(c.getPlan(), channel);
        Map<String, Object> m = paymentMessage(c, paymentId, channel);
        return sendNow(m);
    }

    /**
     * Lembretes de dívida ou mensagem livre para vários clientes.
     * customerIds vazio + debtorsOnly → todos os devedores (opcionalmente só vencidos / dívida mínima).
     */
    @Transactional
    public Map<String, Object> bulk(Long cid, Dto.MessageSend d) {
        Company c = company(cid);
        Plans.require(c.getPlan(), d.channel());
        CompanySetting s = pricing.settings(cid);
        String kind = Text.blank(d.text()) ? "reminder" : "custom";
        String template = Text.blank(d.text()) ? nz(s.getMsgReminderTemplate(), DEFAULT_REMINDER) : d.text().trim();
        List<Map<String, Object>> targets;
        if (d.customerIds() != null && !d.customerIds().isEmpty()) {
            if (d.customerIds().size() > 2000) throw ApiException.badRequest("Máximo de 2000 clientes por envio.");
            targets = new ArrayList<>();
            for (Long id : d.customerIds()) {
                Map<String, Object> row = db.one("messages.customer", Q.company(cid).id("id", id).map());
                if (row != null) targets.add(row);
            }
        } else {
            targets = db.list("messages.debtors", Q.company(cid).set("overdueOnly", Boolean.TRUE.equals(d.overdueOnly()) ? 1 : 0)
                    .set("minDebt", d.minDebt() == null ? BigDecimal.ZERO : d.minDebt())
                    .set("debtorsOnly", Boolean.FALSE.equals(d.debtorsOnly()) ? 0 : 1).limit(5000).map());
        }
        int created = 0, skipped = 0;
        List<Map<String, Object>> manual = new ArrayList<>();
        for (Map<String, Object> t : targets) {
            String phone = Db.str(t, "phone");
            if (Text.digits(phone).length() < 6) {
                skipped++;
                continue;
            }
            Map<String, String> vars = baseVars(c, s);
            vars.put("cliente", firstName(Db.str(t, "name")));
            vars.put("nome", Db.str(t, "name"));
            vars.put("codigo", Db.str(t, "code"));
            vars.put("divida", money(Db.dec(t, "debt"), s));
            vars.put("faturas", String.valueOf(Db.lng(t, "invoices") == null ? 0 : Db.lng(t, "invoices")));
            Message m = save(cid, Db.lng(t, "id"), d.channel(), kind, null, phone, render(template, vars), s);
            created++;
            if ("manual".equals(m.getStatus()) && manual.size() < 500) {
                Map<String, Object> v = view(m);
                v.put("customer_name", Db.str(t, "name"));
                manual.add(v);
            }
        }
        audit.log("MESSAGE_BULK", "messages", d.channel() + " " + kind + " " + created + " criadas, " + skipped + " sem telefone");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("created", created);
        out.put("skipped", skipped);
        out.put("api", gateway.apiReady(s, d.channel()));
        out.put("manual", manual);
        return out;
    }

    /** Operador abriu a mensagem no WhatsApp/SMS do telemóvel → conta como enviada. */
    @Transactional
    public void opened(Long cid, Long id) {
        Message m = message(cid, id);
        if ("manual".equals(m.getStatus()) || "failed".equals(m.getStatus())) {
            m.setStatus("sent");
            m.setProviderRef("link");
            m.setSentAt(LocalDateTime.now());
            messages.save(m);
        }
    }

    @Transactional
    public void cancel(Long cid, Long id) {
        Message m = message(cid, id);
        if ("sent".equals(m.getStatus())) throw ApiException.badRequest("A mensagem já foi enviada.");
        m.setStatus("cancelled");
        messages.save(m);
    }

    /** Volta a tentar uma mensagem que falhou (ou passa-a para envio manual se a API foi desligada). */
    @Transactional
    public Map<String, Object> retry(Long cid, Long id) {
        Message m = message(cid, id);
        if (!"failed".equals(m.getStatus()) && !"cancelled".equals(m.getStatus())) throw ApiException.badRequest("Só mensagens com falha ou canceladas.");
        Plans.require(company(cid).getPlan(), m.getChannel());
        CompanySetting s = pricing.settings(cid);
        m.setStatus(gateway.apiReady(s, m.getChannel()) ? "queued" : "manual");
        m.setAttempts(0);
        m.setError(null);
        messages.save(m);
        return sendNow(view(m));
    }

    // ---------------- Envio automático (fila) ----------------
    /** De 20 em 20 segundos envia as mensagens em fila pela API do WhatsApp/SMS. */
    @Scheduled(fixedDelayString = "${app.messages-interval-ms:20000}", initialDelay = 15000)
    public void dispatch() {
        List<Message> queue = messages.findTop50ByStatusOrderByIdAsc("queued");
        for (Message m : queue) {
            try {
                tx.executeWithoutResult(st -> deliver(messages.findById(m.getId()).orElse(null)));
            } catch (RuntimeException e) {
                log.warn("Falha ao enviar a mensagem {}: {}", m.getId(), e.getMessage());
            }
        }
    }

    private void deliver(Message m) {
        if (m == null || !"queued".equals(m.getStatus())) return;
        Company c = companies.findById(m.getCompanyId()).orElse(null);
        if (c == null || !"active".equals(c.getStatus()) || !Plans.allows(c.getPlan(), m.getChannel())) {
            m.setStatus("cancelled");
            m.setError("Plano da empresa não inclui " + m.getChannel() + " ou empresa inativa.");
            messages.save(m);
            return;
        }
        CompanySetting s = pricing.settings(c.getId());
        if (!gateway.apiReady(s, m.getChannel())) {
            m.setStatus("manual");
            messages.save(m);
            return;
        }
        MessageGateway.Result r = gateway.send(s, m.getChannel(), m.getToPhone(), m.getBody());
        m.setAttempts(m.getAttempts() + 1);
        if (r.ok()) {
            m.setStatus("sent");
            m.setSentAt(LocalDateTime.now());
            m.setProviderRef(r.ref() == null ? null : r.ref().length() > 120 ? r.ref().substring(0, 120) : r.ref());
            m.setError(null);
        } else {
            m.setError(r.error());
            if (m.getAttempts() >= 3) m.setStatus("failed");
        }
        messages.save(m);
    }

    // ---------------- Eventos (mensagens automáticas) ----------------
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onInvoice(MessageEvents.InvoiceIssued e) {
        auto(e.companyId(), true, e.invoiceId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPayment(MessageEvents.PaymentConfirmed e) {
        auto(e.companyId(), false, e.paymentId());
    }

    private void auto(Long cid, boolean invoice, Long refId) {
        try {
            tx.executeWithoutResult(st -> {
                Company c = companies.findById(cid).orElse(null);
                if (c == null || !(Plans.whatsapp(c.getPlan()) || Plans.sms(c.getPlan()))) return;
                CompanySetting s = pricing.settings(cid);
                if (invoice ? !Boolean.TRUE.equals(s.getMsgOnInvoice()) : !Boolean.TRUE.equals(s.getMsgOnPayment())) return;
                for (String ch : channels(c.getPlan(), s.getMsgChannel())) {
                    if (invoice) invoiceMessage(c, refId, ch);
                    else paymentMessage(c, refId, ch);
                }
            });
        } catch (RuntimeException ex) {
            log.warn("Mensagem automática não criada ({} {}): {}", invoice ? "fatura" : "pagamento", refId, ex.getMessage());
        }
    }

    /** Canais escolhidos pela empresa, limitados ao plano. */
    static List<String> channels(String plan, String choice) {
        List<String> out = new ArrayList<>();
        String c = choice == null ? "whatsapp" : choice;
        if (("whatsapp".equals(c) || "both".equals(c)) && Plans.whatsapp(plan)) out.add("whatsapp");
        if (("sms".equals(c) || "both".equals(c)) && Plans.sms(plan)) out.add("sms");
        if (out.isEmpty() && Plans.whatsapp(plan)) out.add("whatsapp");
        return out;
    }

    // ---------------- Montagem das mensagens ----------------
    private Map<String, Object> invoiceMessage(Company c, Long invoiceId, String channel) {
        CompanySetting s = pricing.settings(c.getId());
        Map<String, Object> i = db.require("invoices.detail", Q.company(c.getId()).id("id", invoiceId).map(), "Fatura não encontrada.");
        if ("cancelled".equals(i.get("status"))) throw ApiException.badRequest("A fatura está anulada.");
        Map<String, Object> cu = db.one("messages.customer", Q.company(c.getId()).id("id", Db.lng(i, "customer_id")).map());
        Map<String, String> v = baseVars(c, s);
        v.put("cliente", firstName(Db.str(i, "customer_name")));
        v.put("nome", Db.str(i, "customer_name"));
        v.put("codigo", Db.str(i, "customer_code"));
        v.put("fatura", Db.str(i, "number"));
        v.put("mes", periodLong(Db.str(i, "period")));
        v.put("conta", Db.str(i, "account_number"));
        v.put("leitura_anterior", nz(Db.str(i, "previous_value"), "—"));
        v.put("leitura_atual", nz(Db.str(i, "current_value"), "—"));
        v.put("consumo", nz(Db.str(i, "consumption"), "0"));
        v.put("valor", money(Db.dec(i, "balance"), s));
        v.put("total", money(Db.dec(i, "total"), s));
        v.put("vencimento", date(Db.str(i, "due_date")));
        v.put("divida", money(Db.dec(cu, "debt"), s));
        v.put("faturas", String.valueOf(cu == null || Db.lng(cu, "invoices") == null ? 0 : Db.lng(cu, "invoices")));
        String template = "manual".equals(i.get("kind"))
                ? "Olá {cliente}. {empresa}: fatura {fatura} — " + nz(Db.str(i, "description"), "serviço") + ". Valor a pagar: {valor}, até {vencimento}. Dívida total: {divida}."
                : nz(s.getMsgInvoiceTemplate(), DEFAULT_INVOICE);
        String phone = Db.str(i, "phone");
        if (Text.digits(phone).length() < 6) throw ApiException.badRequest("O cliente não tem telefone válido.");
        return view(save(c.getId(), Db.lng(i, "customer_id"), channel, "invoice", invoiceId, phone, render(template, v), s));
    }

    private Map<String, Object> paymentMessage(Company c, Long paymentId, String channel) {
        CompanySetting s = pricing.settings(c.getId());
        Map<String, Object> p = db.require("payments.detail", Q.company(c.getId()).id("id", paymentId).map(), "Pagamento não encontrado.");
        if (!"confirmed".equals(p.get("status"))) throw ApiException.badRequest("Só se envia o recibo de pagamentos confirmados.");
        Map<String, String> v = baseVars(c, s);
        v.put("cliente", firstName(Db.str(p, "customer_name")));
        v.put("nome", Db.str(p, "customer_name"));
        v.put("codigo", Db.str(p, "customer_code"));
        v.put("recibo", Db.str(p, "receipt_number"));
        v.put("pago", money(Db.dec(p, "amount"), s));
        v.put("valor", money(Db.dec(p, "amount"), s));
        v.put("data", datetime(Db.str(p, "paid_at")));
        v.put("divida", money(Db.dec(p, "debt_now"), s));
        String phone = Db.str(p, "phone");
        if (Text.digits(phone).length() < 6) throw ApiException.badRequest("O cliente não tem telefone válido.");
        return view(save(c.getId(), Db.lng(p, "customer_id"), channel, "payment", paymentId, phone,
                render(nz(s.getMsgPaymentTemplate(), DEFAULT_PAYMENT), v), s));
    }

    private Message save(Long cid, Long customerId, String channel, String kind, Long refId, String phone, String body,
                         CompanySetting s) {
        Message m = new Message();
        m.setCompanyId(cid);
        m.setCustomerId(customerId);
        m.setChannel(channel);
        m.setKind(kind);
        m.setRefId(refId);
        m.setToPhone(phone.trim());
        m.setBody(body.length() > 1500 ? body.substring(0, 1500) : body);
        m.setStatus(gateway.apiReady(s, channel) ? "queued" : "manual");
        m.setAttempts(0);
        m.setUserId(CurrentUser.optional().map(SessionUser::id).orElse(null));
        return messages.saveAndFlush(m);
    }

    /** Envio imediato pedido no ecrã (uma mensagem): com API envia já; sem API devolve o link. */
    private Map<String, Object> sendNow(Map<String, Object> view) {
        if ("queued".equals(view.get("status"))) {
            Message m = messages.findById((Long) view.get("id")).orElseThrow();
            deliver(m);
            return view(m);
        }
        return view;
    }

    Map<String, Object> view(Message m) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("channel", m.getChannel());
        out.put("kind", m.getKind());
        out.put("status", m.getStatus());
        out.put("to_phone", m.getToPhone());
        out.put("body", m.getBody());
        out.put("error", m.getError());
        out.put("link", link(m.getChannel(), m.getToPhone(), m.getBody()));
        return out;
    }

    /** wa.me/258…?text=… ou sms:+258…?body=… — abre o WhatsApp/SMS do telemóvel com o texto pronto. */
    public static String link(String channel, String phone, String text) {
        String to = MessageGateway.international(phone);
        String enc = URLEncoder.encode(text == null ? "" : text, StandardCharsets.UTF_8).replace("+", "%20");
        return "sms".equals(channel) ? "sms:+" + to + "?body=" + enc : "https://wa.me/" + to + "?text=" + enc;
    }

    // ---------------- Auxiliares ----------------
    private Map<String, String> baseVars(Company c, CompanySetting s) {
        Map<String, String> v = new HashMap<>();
        v.put("empresa", c.getName());
        v.put("telefone_empresa", nz(c.getPhone(), ""));
        v.put("whatsapp_empresa", nz(s.getWhatsappNumber(), nz(c.getPhone(), "")));
        v.put("como_pagar", nz(s.getPaymentInstructions(), "").replace('\n', ' '));
        return v;
    }

    /** Substitui {chave} pelos valores; chaves desconhecidas ficam vazias. */
    static String render(String template, Map<String, String> vars) {
        StringBuilder out = new StringBuilder();
        int i = 0;
        while (i < template.length()) {
            int open = template.indexOf('{', i);
            int close = open < 0 ? -1 : template.indexOf('}', open);
            if (open < 0 || close < 0) {
                out.append(template, i, template.length());
                break;
            }
            out.append(template, i, open);
            String key = template.substring(open + 1, close).trim().toLowerCase();
            if (key.matches("[a-z_]{2,30}")) {
                out.append(nz(vars.get(key), ""));
            } else {
                out.append(template, open, close + 1);
            }
            i = close + 1;
        }
        return out.toString().replaceAll("[ \\t]+", " ").trim();
    }

    private static String money(BigDecimal v, CompanySetting s) {
        BigDecimal n = (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
        String[] parts = n.abs().toPlainString().split("\\.");
        String integer = parts[0].replaceAll("\\B(?=(\\d{3})+(?!\\d))", " ");
        return (n.signum() < 0 ? "-" : "") + integer + "," + parts[1] + " " + nz(s.getCurrency(), "MZN");
    }

    private static final String[] MONTHS = {"Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto",
            "Setembro", "Outubro", "Novembro", "Dezembro"};

    private static String periodLong(String p) {
        if (p == null || !p.matches("\\d{4}-\\d{2}")) return nz(p, "");
        return MONTHS[Integer.parseInt(p.substring(5)) - 1] + " de " + p.substring(0, 4);
    }

    private static String date(String d) {
        return d != null && d.matches("\\d{4}-\\d{2}-\\d{2}.*") ? d.substring(8, 10) + "/" + d.substring(5, 7) + "/" + d.substring(0, 4) : nz(d, "");
    }

    private static String datetime(String d) {
        return d != null && d.length() >= 16 ? date(d) + " " + d.substring(11, 16) : date(d);
    }

    private static String firstName(String name) {
        if (name == null) return "";
        String[] p = name.trim().split("\\s+");
        return p.length == 0 ? name : p[0];
    }

    private static String nz(String v, String def) {
        return v == null || v.isBlank() ? def : v;
    }

    private Company company(Long cid) {
        return companies.findById(cid).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
    }

    private void requireMessaging(Long cid) {
        String plan = company(cid).getPlan();
        if (!Plans.whatsapp(plan) && !Plans.sms(plan)) {
            throw ApiException.forbidden("O módulo de mensagens faz parte dos planos Standard e Enterprise.");
        }
    }

    private Message message(Long cid, Long id) {
        Message m = messages.findById(id).orElseThrow(() -> ApiException.notFound("Mensagem não encontrada."));
        if (!Objects.equals(m.getCompanyId(), cid)) throw ApiException.notFound("Mensagem não encontrada.");
        return m;
    }
}
