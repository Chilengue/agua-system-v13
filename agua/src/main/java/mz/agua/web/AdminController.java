package mz.agua.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mz.agua.common.Resp;
import mz.agua.dto.Dto;
import mz.agua.security.CurrentUser;
import mz.agua.service.AdminService;
import mz.agua.service.CompanyService;
import mz.agua.service.DashboardService;
import mz.agua.service.PasswordResetService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

/** Painel do administrador da plataforma (/api/admin/...). */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService admin;
    private final CompanyService companies;
    private final DashboardService dashboard;
    private final PasswordResetService resets;

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestParam(required = false) String period,
                                         @RequestParam(required = false) Long company) {
        CurrentUser.admin();
        return Resp.ok().withAll(dashboard.admin(period, company)).build();
    }

    // ---------------- Empresas ----------------
    @GetMapping("/companies")
    public Map<String, Object> companies(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                         @RequestParam(required = false) String plan,
                                         @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        CurrentUser.admin();
        return admin.companies(q, status, plan, page, size);
    }

    /** Plano da empresa: basic (sem WhatsApp/SMS) · standard (WhatsApp) · enterprise (WhatsApp + SMS). */
    @PostMapping("/companies/{id}/plan")
    public Map<String, Object> companyPlan(@PathVariable Long id, @Valid @RequestBody Dto.Plan body) {
        CurrentUser.admin();
        companies.setPlan(id, body.plan(), body.reason());
        return Resp.message("Plano atualizado.");
    }

    @GetMapping("/companies/{id}")
    public Map<String, Object> company(@PathVariable Long id) {
        CurrentUser.admin();
        return Resp.ok("company", admin.company(id));
    }

    @PostMapping("/companies")
    public Map<String, Object> createCompany(@Valid @RequestBody Dto.Company body) {
        CurrentUser.admin();
        return Resp.ok().withAll(companies.createByAdmin(body)).build();
    }

    @PutMapping("/companies/{id}")
    public Map<String, Object> updateCompany(@PathVariable Long id, @Valid @RequestBody Dto.CompanyProfile body) {
        CurrentUser.admin();
        companies.update(id, body);
        return Resp.message("Empresa atualizada.");
    }

    /** status: active (aprovar/reativar) · suspended · rejected */
    @PostMapping("/companies/{id}/status/{status}")
    public Map<String, Object> companyStatus(@PathVariable Long id, @PathVariable String status,
                                             @RequestBody(required = false) Map<String, String> body) {
        CurrentUser.admin();
        companies.setStatus(id, status, body == null ? null : body.get("reason"));
        return Resp.message("Estado da empresa atualizado.");
    }

    @PostMapping("/companies/{id}/reset-manager")
    public Map<String, Object> resetManager(@PathVariable Long id) {
        CurrentUser.admin();
        return Resp.ok().withAll(companies.resetManager(id)).build();
    }

    // ---------------- Utilizadores ----------------
    @GetMapping("/users")
    public Map<String, Object> users(@RequestParam(required = false) String q, @RequestParam(required = false) Long company,
                                     @RequestParam(required = false) String role, @RequestParam(required = false) String status,
                                     @RequestParam(defaultValue = "false") boolean missingEmail,
                                     @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        CurrentUser.admin();
        return admin.users(q, company, role, status, missingEmail, page, size);
    }

    @PutMapping("/users/{id}")
    public Map<String, Object> updateUser(@PathVariable Long id, @Valid @RequestBody Dto.UserUpdate body) {
        CurrentUser.admin();
        admin.updateUser(id, body);
        return Resp.message("Utilizador atualizado.");
    }

    @PostMapping("/users/{id}/reset-password")
    public Map<String, Object> resetUser(@PathVariable Long id) {
        CurrentUser.admin();
        return Resp.ok().withAll(admin.resetUserPassword(id)).build();
    }

    // ---------------- Clientes, pagamentos, devedores ----------------
    @GetMapping("/customers")
    public Map<String, Object> customers(@RequestParam(required = false) String q, @RequestParam(required = false) Long company,
                                         @RequestParam(required = false) String plan,
                                         @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        CurrentUser.admin();
        return admin.customers(q, company, plan, page, size);
    }

    @GetMapping("/customers/{id}/history")
    public Map<String, Object> customerHistory(@PathVariable Long id) {
        CurrentUser.admin();
        return Resp.ok().withAll(admin.customerHistory(id)).build();
    }

    @GetMapping("/payments")
    public Map<String, Object> payments(@RequestParam(required = false) String q, @RequestParam(required = false) Long company,
                                        @RequestParam(required = false) String status, @RequestParam(required = false) String method,
                                        @RequestParam(required = false) String from, @RequestParam(required = false) String to,
                                        @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        CurrentUser.admin();
        return admin.payments(q, company, status, method, from, to, page, size);
    }

    @GetMapping("/debtors")
    public Map<String, Object> debtors(@RequestParam(required = false) String q, @RequestParam(required = false) Long company,
                                       @RequestParam(defaultValue = "false") boolean overdueOnly,
                                       @RequestParam(required = false) BigDecimal minDebt,
                                       @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        CurrentUser.admin();
        return admin.debtors(q, company, overdueOnly, minDebt, page, size);
    }

    // ---------------- Recuperação de senha e auditoria ----------------
    @GetMapping("/password-resets")
    public Map<String, Object> passwordResets(@RequestParam(required = false) String status) {
        CurrentUser.admin();
        return Resp.ok("items", admin.resets(status));
    }

    @PostMapping("/password-resets/{id}/resolve")
    public Map<String, Object> resolveReset(@PathVariable Long id) {
        CurrentUser.admin();
        return Resp.ok().withAll(resets.resolveByAdmin(id, CurrentUser.get().id(), null)).build();
    }

    @PostMapping("/password-resets/{id}/cancel")
    public Map<String, Object> cancelReset(@PathVariable Long id) {
        CurrentUser.admin();
        resets.cancel(id, null);
        return Resp.message("Pedido cancelado.");
    }

    @GetMapping("/audit")
    public Map<String, Object> audit(@RequestParam(required = false) String q, @RequestParam(required = false) Long company,
                                     @RequestParam(required = false) String from, @RequestParam(required = false) String to,
                                     @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        CurrentUser.admin();
        return admin.audit(q, company, from, to, page, size);
    }
}
