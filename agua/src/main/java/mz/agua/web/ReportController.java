package mz.agua.web;

import lombok.RequiredArgsConstructor;
import mz.agua.common.Db;
import mz.agua.common.Q;
import mz.agua.common.Resp;
import mz.agua.security.CurrentUser;
import mz.agua.service.DashboardService;
import mz.agua.service.ReportService;
import mz.agua.service.StatementService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

/** Painel do gestor, devedores, relatórios e extratos. */
@RestController
@RequiredArgsConstructor
public class ReportController {

    private final DashboardService dashboard;
    private final ReportService reports;
    private final StatementService statements;
    private final Db db;

    @GetMapping("/api/dashboard")
    public Map<String, Object> dashboard(@RequestParam(required = false) String period) {
        return Resp.ok().withAll(dashboard.manager(CurrentUser.manager(), period)).build();
    }

    @GetMapping("/api/debtors")
    public Map<String, Object> debtors(@RequestParam(required = false) String q,
                                       @RequestParam(defaultValue = "false") boolean overdueOnly,
                                       @RequestParam(required = false) BigDecimal minDebt,
                                       @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        Long cid = CurrentUser.manager();
        return db.page("debtors.list", Q.of().search(q).id("company", cid).set("overdueOnly", overdueOnly ? 1 : 0)
                .set("minDebt", minDebt == null ? BigDecimal.ZERO : minDebt).paging(page, size));
    }

    /** type: billing · collections · consumption · readers · cashiers · debtors · payers */
    @GetMapping("/api/reports/{type}")
    public Map<String, Object> report(@PathVariable String type,
                                      @RequestParam(required = false) String fromPeriod, @RequestParam(required = false) String toPeriod,
                                      @RequestParam(required = false) String from, @RequestParam(required = false) String to,
                                      @RequestParam(required = false) Integer overdueOnly, @RequestParam(required = false) BigDecimal minDebt) {
        return Resp.ok().withAll(reports.run(CurrentUser.manager(), type, fromPeriod, toPeriod, from, to, overdueOnly, minDebt)).build();
    }

    /** Extrato do cliente. mode: all (todas as contas juntas) · each (uma por conta) · single (accountId). */
    @GetMapping("/api/customers/{id}/statement")
    public Map<String, Object> statement(@PathVariable Long id, @RequestParam(required = false) Long accountId,
                                         @RequestParam(defaultValue = "all") String mode,
                                         @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return Resp.ok("statement", statements.statement(CurrentUser.manager(), id, accountId, mode, from, to));
    }
}
