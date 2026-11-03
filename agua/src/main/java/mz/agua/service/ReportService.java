package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Periods;
import mz.agua.common.Q;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Relatórios do gestor (diferentes dos extratos: aqui são totais da empresa).
 * Cada relatório devolve linhas + totais; o ecrã imprime ou baixa em Excel (CSV).
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    private final Db db;
    private final SettingsService settings;

    public Map<String, Object> run(Long cid, String type, String fromPeriod, String toPeriod, String from, String to,
                                   Integer overdueOnly, BigDecimal minDebt) {
        String fp = fromPeriod == null || fromPeriod.isBlank() ? LocalDate.now().getYear() + "-01" : Periods.validate(fromPeriod);
        String tp = toPeriod == null || toPeriod.isBlank() ? Periods.current() : Periods.validate(toPeriod);
        if (fp.compareTo(tp) > 0) throw ApiException.badRequest("O período inicial é depois do final.");
        String f = from == null || from.isBlank() ? LocalDate.now().withDayOfMonth(1).toString() : from;
        String t = to == null || to.isBlank() ? LocalDate.now().toString() : to;
        Q q = Q.company(cid).str("fromPeriod", fp).str("toPeriod", tp).dates(f, t);
        List<Map<String, Object>> rows = switch (type) {
            case "billing" -> db.list("rep.billing", q.map());
            case "collections" -> db.list("rep.collections", q.map());
            case "consumption" -> db.list("rep.consumption", q.map());
            case "readers" -> db.list("rep.readers", q.map());
            case "cashiers" -> db.list("rep.cashiers", q.map());
            case "debtors" -> {
                List<Map<String, Object>> l = db.list("debtors.list", q.id("company", cid).set("overdueOnly", overdueOnly == null ? 0 : overdueOnly)
                        .set("minDebt", minDebt == null ? BigDecimal.ZERO : minDebt).limit(Q.MAX_SIZE).map());
                l.forEach(r -> r.remove("total_rows"));
                yield l;
            }
            case "payers" -> db.list("dash.payers", q.period(tp).limit(Q.MAX_SIZE).map());
            default -> throw ApiException.badRequest("Relatório desconhecido: " + type);
        };
        Map<String, Object> totals = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            r.forEach((k, v) -> {
                if (v instanceof Number n && !k.endsWith("id") && !k.equals("days_late") && !k.equals("average")) {
                    BigDecimal cur = totals.get(k) instanceof BigDecimal b ? b : BigDecimal.ZERO;
                    totals.put(k, cur.add(new BigDecimal(n.toString())));
                }
            });
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type);
        out.put("from_period", fp);
        out.put("to_period", tp);
        out.put("from", f);
        out.put("to", t);
        out.put("rows", rows);
        out.put("totals", totals);
        out.put("company", settings.branding(cid));
        return out;
    }
}
