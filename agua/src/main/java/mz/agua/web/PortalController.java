package mz.agua.web;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Q;
import mz.agua.common.Resp;
import mz.agua.security.CurrentUser;
import mz.agua.security.Roles;
import mz.agua.security.SessionUser;
import mz.agua.service.BillingService;
import mz.agua.service.PaymentService;
import mz.agua.service.PortalService;
import mz.agua.service.SettingsService;
import mz.agua.service.StatementService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Objects;

/** Portal do cliente (só os seus dados: o cliente vem sempre da sessão). */
@RestController
@RequiredArgsConstructor
public class PortalController {

    private final PortalService portal;
    private final StatementService statements;
    private final PaymentService payments;
    private final BillingService billing;
    private final SettingsService settings;
    private final Db db;

    @GetMapping("/api/portal")
    public Map<String, Object> overview() {
        SessionUser u = me();
        return Resp.ok().withAll(portal.overview(u.companyId(), u.customerId())).build();
    }

    @GetMapping("/api/portal/statement")
    public Map<String, Object> statement(@RequestParam(required = false) Long accountId, @RequestParam(defaultValue = "all") String mode,
                                         @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        SessionUser u = me();
        return Resp.ok("statement", statements.statement(u.companyId(), u.customerId(), accountId, mode, from, to));
    }

    @GetMapping("/api/portal/receipts/{id}")
    public Map<String, Object> receipt(@PathVariable Long id) {
        SessionUser u = me();
        Map<String, Object> r = payments.receipt(u.companyId(), id);
        if (!Objects.equals(Db.lng(r, "customer_id"), u.customerId())) throw ApiException.notFound("Recibo não encontrado.");
        return Resp.ok("receipt", r);
    }

    @GetMapping("/api/portal/invoices/{id}")
    public Map<String, Object> invoice(@PathVariable Long id) {
        SessionUser u = me();
        Map<String, Object> i = billing.detail(u.companyId(), id);
        if (!Objects.equals(Db.lng(i, "customer_id"), u.customerId())) throw ApiException.notFound("Fatura não encontrada.");
        return Resp.ok().with("invoice", i).with("company", settings.branding(u.companyId())).build();
    }

    private static SessionUser me() {
        SessionUser u = CurrentUser.require(Roles.CUSTOMER);
        if (u.customerId() == null || u.companyId() == null) throw ApiException.forbidden("Conta de cliente inválida.");
        return u;
    }
}
