package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Periods;
import mz.agua.common.Q;
import mz.agua.common.Text;
import mz.agua.domain.Company;
import mz.agua.domain.Customer;
import mz.agua.domain.User;
import mz.agua.dto.Dto;
import mz.agua.repository.CompanyRepository;
import mz.agua.repository.CustomerRepository;
import mz.agua.repository.UserRepository;
import mz.agua.security.CurrentUser;
import mz.agua.security.Plans;
import mz.agua.security.Roles;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Painel do administrador da plataforma: empresas, utilizadores (corrigir email/nome para a
 * recuperação de senha), clientes e histórico de pagamentos de qualquer empresa, devedores e auditoria.
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final Db db;
    private final UserRepository users;
    private final CompanyRepository companies;
    private final CustomerRepository customers;
    private final UserFactory userFactory;
    private final AuditService audit;

    public Map<String, Object> companies(String q, String status, String plan, Integer page, Integer size) {
        return db.page("admin.companies", Q.of().search(q).str("status", status).str("plan", plan)
                .period(Periods.current()).paging(page, size));
    }

    public Map<String, Object> company(Long id) {
        Company c = companies.findById(id).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
        Map<String, Object> out = SettingsService.companyView(c, true);
        out.put("notes", c.getNotes());
        out.put("self_registered", c.getSelfRegistered());
        out.put("plan_changed_at", c.getPlanChangedAt());
        out.put("features", Plans.features(c.getPlan()));
        out.put("users", db.list("admin.users", Q.of().id("company", id).str("role", "").set("missing", 0).limit(500).map()));
        out.put("monthly", db.list("admin.monthly", Q.of().period(Periods.current()).id("company", id).map()));
        out.put("kpis", db.one("dash.kpis", Q.company(id).period(Periods.current()).map()));
        return out;
    }

    public Map<String, Object> users(String q, Long company, String role, String status, boolean missingEmail,
                                     Integer page, Integer size) {
        return db.page("admin.users", Q.of().search(q).id("company", company).str("role", role).str("status", status)
                .set("missing", missingEmail ? 1 : 0).paging(page, size));
    }

    /**
     * Admin corrige nome/email/telefone (dados usados na recuperação de senha) e bloqueia/desbloqueia.
     * Só gestores e administradores: mediadores e clientes são geridos pelo gestor de cada empresa.
     */
    @Transactional
    public void updateUser(Long id, Dto.UserUpdate d) {
        User u = staff(id);
        if (Objects.equals(u.getId(), CurrentUser.get().id()) && "blocked".equals(d.status())) {
            throw ApiException.badRequest("Não pode bloquear a sua própria conta.");
        }
        u.setName(Text.clean(d.name()));
        u.setEmail(userFactory.checkEmail(d.email(), u.getId()));
        u.setPhone(Text.clean(d.phone()));
        if (d.status() != null && !d.status().isBlank()) u.setStatus(d.status());
        users.save(u);
        audit.log("USER_UPDATE", "users/" + id, null);
    }

    /** Gestor ou administrador (o admin não vê nem altera utilizadores de mediadores e clientes). */
    private User staff(Long id) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("Utilizador não encontrado."));
        if (!Roles.MANAGER.equals(u.getRole()) && !Roles.ADMIN.equals(u.getRole())) {
            throw ApiException.forbidden("Mediadores e clientes são geridos pelo gestor da empresa.");
        }
        return u;
    }

    @Transactional
    public Map<String, Object> resetUserPassword(Long id) {
        User u = staff(id);
        String temp = userFactory.resetPassword(u);
        audit.log("USER_PASSWORD_RESET", "users/" + id, null);
        return TeamService.credentials(u, temp);
    }

    public Map<String, Object> customers(String q, Long company, String plan, Integer page, Integer size) {
        return db.page("admin.customers", Q.of().search(q).id("company", company).str("plan", plan).paging(page, size));
    }

    public Map<String, Object> customerHistory(Long customerId) {
        Customer c = customers.findById(customerId).orElseThrow(() -> ApiException.notFound("Cliente não encontrado."));
        Company co = companies.findById(c.getCompanyId()).orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> detail = db.one("customers.detail", Q.company(c.getCompanyId()).id("id", customerId).map());
        if (detail != null) {      // dados de acesso do cliente são do gestor da empresa
            detail.remove("user_id");
            detail.remove("login");
            detail.remove("login_status");
            detail.remove("last_login");
        }
        out.put("customer", detail);
        out.put("company_name", co == null ? "" : co.getName());
        out.put("company_plan", co == null ? null : co.getPlan());
        out.put("accounts", db.list("customers.accounts", Q.company(c.getCompanyId()).id("id", customerId).map()));
        out.put("payments", db.list("admin.customer_payments", Q.of().id("customerId", customerId).map()));
        out.put("invoices", db.list("invoices.list", Q.company(c.getCompanyId()).id("customerId", customerId).id("accountId", 0L)
                .limit(500).map()));
        return out;
    }

    public Map<String, Object> payments(String q, Long company, String status, String method, String from, String to,
                                        Integer page, Integer size) {
        Map<String, Object> out = db.page("admin.payments", Q.of().search(q).id("company", company).str("status", status)
                .str("method", method).dates(from, to).paging(page, size));
        out.put("stats", db.one("admin.payments_stats", Q.of().id("company", company).dates(from, to).map()));
        return out;
    }

    public Map<String, Object> debtors(String q, Long company, boolean overdueOnly, BigDecimal minDebt, Integer page, Integer size) {
        return db.page("debtors.list", Q.of().search(q).id("company", company).set("overdueOnly", overdueOnly ? 1 : 0)
                .set("minDebt", minDebt == null ? BigDecimal.ZERO : minDebt).paging(page, size));
    }

    public Object resets(String status) {
        return db.list("admin.resets", Q.of().str("status", status).limit(200).map());
    }

    public Map<String, Object> audit(String q, Long company, String from, String to, Integer page, Integer size) {
        return db.page("audit.list", Q.of().search(q).id("company", company).dates(from, to).paging(page, size));
    }
}
