package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.Db;
import mz.agua.common.Periods;
import mz.agua.common.Q;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/** Painel do gestor (com filtro de mês) e painel do administrador. */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final Db db;

    public Map<String, Object> manager(Long cid, String period) {
        String p = period == null || period.isBlank() ? Periods.current() : Periods.validate(period);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", p);
        out.put("kpis", db.one("dash.kpis", Q.company(cid).period(p).map()));
        out.put("monthly", db.list("dash.monthly", Q.company(cid).period(p).map()));
        out.put("payers", db.list("dash.payers", Q.company(cid).period(p).limit(10).map()));
        out.put("debtors", db.list("debtors.list", Q.of().id("company", cid).set("overdueOnly", 0).set("minDebt", 0)
                .limit(10).map()));
        out.put("methods", db.list("dash.methods", Q.company(cid).period(p).map()));
        return out;
    }

    public Map<String, Object> admin(String period, Long company) {
        String p = period == null || period.isBlank() ? Periods.current() : Periods.validate(period);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", p);
        out.put("kpis", db.one("admin.kpis", Q.of().period(p).map()));
        out.put("monthly", db.list("admin.monthly", Q.of().period(p).id("company", company).map()));
        out.put("companies", db.list("admin.companies", Q.of().period(p).str("plan", "").limit(100).map()));
        out.put("plans", db.list("admin.plans", Q.of().period(p).map()));
        out.put("debtors", db.list("debtors.list", Q.of().id("company", company).set("overdueOnly", 1).set("minDebt", 0)
                .limit(10).map()));
        return out;
    }
}
