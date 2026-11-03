package mz.agua.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mz.agua.common.Resp;
import mz.agua.config.AppProperties;
import mz.agua.dto.Dto;
import mz.agua.security.ClientIp;
import mz.agua.security.CurrentUser;
import mz.agua.security.RateLimiter;
import mz.agua.security.SessionUser;
import mz.agua.service.AuditService;
import mz.agua.service.AuthService;
import mz.agua.service.CompanyService;
import mz.agua.service.PasswordResetService;
import mz.agua.service.SetupService;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Sessão: login, logout, troca de senha, recuperação, registo de empresa e configuração inicial. */
@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService auth;
    private final SetupService setup;
    private final CompanyService companies;
    private final PasswordResetService resets;
    private final AuditService audit;
    private final RateLimiter limiter;
    private final SecurityContextRepository contexts;
    private final AppProperties props;

    @PostMapping("/api/auth/login")
    public Map<String, Object> login(@Valid @RequestBody Dto.Login body, HttpServletRequest req, HttpServletResponse res) {
        limiter.check("login", ClientIp.of(req), 10);
        SessionUser u = auth.authenticate(body.username(), body.password());
        store(u, req, res, true);
        return Resp.ok().with("user", user(u)).with("redirect", u.home()).build();
    }

    @PostMapping("/api/auth/logout")
    public Map<String, Object> logout(HttpServletRequest req) {
        CurrentUser.optional().ifPresent(u -> audit.log("LOGOUT", "auth", null));
        HttpSession s = req.getSession(false);
        if (s != null) s.invalidate();
        SecurityContextHolder.clearContext();
        return Resp.message("Sessão terminada.");
    }

    @GetMapping("/api/auth/session")
    public Map<String, Object> session() {
        return Resp.ok("user", CurrentUser.optional().map(AuthController::user).orElse(null));
    }

    @PostMapping("/api/auth/password")
    public Map<String, Object> changePassword(@Valid @RequestBody Dto.ChangePassword body, HttpServletRequest req,
                                              HttpServletResponse res) {
        auth.changePassword(body.currentPassword(), body.newPassword());
        SessionUser updated = CurrentUser.get().withPasswordChanged();
        store(updated, req, res, false);
        return Resp.ok().with("message", "Senha alterada.").with("redirect", updated.home()).build();
    }

    /** Passo 1 da recuperação: email + nome completo usados no registo. */
    @PostMapping("/api/auth/forgot")
    public Map<String, Object> forgot(@Valid @RequestBody Dto.Forgot body, HttpServletRequest req) {
        limiter.check("forgot", ClientIp.of(req), 5);
        return Resp.ok().withAll(resets.request(body.email(), body.name(), ClientIp.of(req))).build();
    }

    /** Passo 2: código recebido por email + nova senha. */
    @PostMapping("/api/auth/reset")
    public Map<String, Object> reset(@Valid @RequestBody Dto.Reset body, HttpServletRequest req) {
        limiter.check("reset", ClientIp.of(req), 10);
        resets.reset(body.email(), body.code(), body.newPassword());
        return Resp.message("Senha alterada. Já pode entrar.");
    }

    /** Registo de empresa no login: gera o código AGUA-XXXX-XXXX e a senha temporária do gestor. */
    @PostMapping("/api/auth/register-company")
    public Map<String, Object> registerCompany(@Valid @RequestBody Dto.Company body, HttpServletRequest req) {
        limiter.check("register", ClientIp.of(req), 5);
        return Resp.ok().withAll(companies.register(body)).build();
    }

    @GetMapping("/api/public/info")
    public Map<String, Object> info() {
        return Resp.ok().with("version", props.version()).with("setup_done", setup.done())
                .with("support_phone", props.supportPhone()).with("support_name", props.supportName())
                .with("auto_approve", props.autoApproveCompanies()).build();
    }

    @GetMapping("/api/setup/status")
    public Map<String, Object> setupStatus() {
        return Resp.ok("done", setup.done());
    }

    @PostMapping("/api/setup")
    public Map<String, Object> setup(@Valid @RequestBody Dto.Setup body, HttpServletRequest req) {
        limiter.check("setup", ClientIp.of(req), 5);
        return Resp.ok().with("username", setup.createAdmin(body).getUsername()).build();
    }

    private void store(SessionUser u, HttpServletRequest req, HttpServletResponse res, boolean newSession) {
        if (newSession) {
            HttpSession old = req.getSession(false);
            if (old != null) old.invalidate();             // nova sessão a cada login
            req.getSession(true);
        }
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(u, null,
                List.of(new SimpleGrantedAuthority(u.authority()))));
        SecurityContextHolder.setContext(ctx);
        contexts.saveContext(ctx, req, res);
    }

    static Map<String, Object> user(SessionUser u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.id());
        m.put("username", u.username());
        m.put("name", u.name());
        m.put("email", u.email());
        m.put("role", u.role());
        m.put("company_id", u.companyId());
        m.put("company_code", u.companyCode());
        m.put("company_name", u.companyName());
        m.put("customer_id", u.customerId());
        m.put("must_change_password", u.mustChangePassword());
        m.put("home", u.home());
        return m;
    }
}
