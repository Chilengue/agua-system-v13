package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.Db;
import mz.agua.common.Q;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Extrato de conta corrente do cliente: faturas (débito), pagamentos (crédito) e saldo acumulado,
 * com leitura anterior/atual de cada fatura. Pode ser de uma conta, de todas juntas
 * ou de todas separadas (uma secção por conta, para imprimir uma a uma).
 */
@Service
@RequiredArgsConstructor
public class StatementService {

    private final Db db;
    private final CustomerService customers;
    private final SettingsService settings;

    /** mode: "single" (accountId), "all" (todas juntas) ou "each" (uma secção por conta). */
    public Map<String, Object> statement(Long cid, Long customerId, Long accountId, String mode, String from, String to) {
        Map<String, Object> customer = customers.detail(cid, customerId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> accounts = (List<Map<String, Object>>) customer.get("accounts");
        String f = from == null || from.isBlank() ? LocalDate.now().minusMonths(12).withDayOfMonth(1).toString() : from;
        String t = to == null || to.isBlank() ? LocalDate.now().toString() : to;

        List<Map<String, Object>> sections = new ArrayList<>();
        if ("each".equals(mode)) {
            for (Map<String, Object> a : accounts) sections.add(section(cid, customerId, Db.lng(a, "id"), a, f, t));
        } else if (accountId != null && accountId > 0) {
            Map<String, Object> acc = accounts.stream().filter(a -> accountId.equals(Db.lng(a, "id"))).findFirst()
                    .orElseThrow(() -> mz.agua.common.ApiException.notFound("Conta não encontrada."));
            sections.add(section(cid, customerId, accountId, acc, f, t));
        } else {
            sections.add(section(cid, customerId, 0L, null, f, t));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("company", settings.branding(cid));
        out.put("customer", customer);
        out.put("from", f);
        out.put("to", t);
        out.put("mode", mode == null ? "all" : mode);
        out.put("sections", sections);
        out.put("generated_at", java.time.LocalDateTime.now().withNano(0).toString().replace('T', ' '));
        return out;
    }

    private Map<String, Object> section(Long cid, Long customerId, Long accountId, Map<String, Object> account,
                                        String from, String to) {
        Q p = Q.company(cid).id("customerId", customerId).id("accountId", accountId).dates(from, to);
        BigDecimal opening = Db.dec(db.one("statement.opening", p.map()), "opening");
        List<Map<String, Object>> rows = db.list("statement.movements", p.map());
        BigDecimal balance = opening;
        BigDecimal debit = BigDecimal.ZERO;
        BigDecimal credit = BigDecimal.ZERO;
        for (Map<String, Object> r : rows) {
            r.remove("sort_date");
            r.remove("sort_kind");
            r.remove("sort_id");
            BigDecimal d = Db.dec(r, "debit");
            BigDecimal c = Db.dec(r, "credit");
            debit = debit.add(d);
            credit = credit.add(c);
            balance = balance.add(d).subtract(c);
            r.put("balance", balance);
        }
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("account", account);
        s.put("opening", opening);
        s.put("movements", rows);
        s.put("total_debit", debit);
        s.put("total_credit", credit);
        s.put("closing", balance);
        return s;
    }
}
