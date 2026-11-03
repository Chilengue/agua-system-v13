package mz.agua.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Resp;
import mz.agua.domain.Company;
import mz.agua.dto.Dto;
import mz.agua.security.CurrentUser;
import mz.agua.security.Roles;
import mz.agua.security.SessionUser;
import mz.agua.service.PasswordResetService;
import mz.agua.service.SettingsService;
import mz.agua.service.TariffCalculator;
import mz.agua.service.TeamService;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Configurações da empresa (gestor), mediadores e dados de marca (nome/logótipo no menu e nos documentos). */
@RestController
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settings;
    private final TeamService team;
    private final SecurityContextRepository contexts;
    private final PasswordResetService resets;

    /** Nome, logótipo e regras do recibo da empresa do utilizador (gestor, mediador ou cliente). */
    @GetMapping("/api/branding")
    public Map<String, Object> branding() {
        SessionUser u = CurrentUser.get();
        if (u.companyId() == null) throw ApiException.notFound("Sem empresa.");
        return Resp.ok("company", settings.branding(u.companyId()));
    }

    @GetMapping("/api/settings")
    public Map<String, Object> get() {
        return Resp.ok().withAll(settings.all(CurrentUser.manager())).build();
    }

    @PutMapping("/api/settings")
    public Map<String, Object> update(@Valid @RequestBody Dto.Settings body) {
        settings.update(CurrentUser.manager(), body);
        return Resp.ok().withAll(settings.all(CurrentUser.manager())).with("message", "Configurações guardadas.").build();
    }

    @PutMapping("/api/settings/company")
    public Map<String, Object> profile(@Valid @RequestBody Dto.CompanyProfile body, HttpServletRequest req, HttpServletResponse res) {
        Company c = settings.updateProfile(CurrentUser.manager(), body);
        // o nome novo aparece logo no menu lateral
        SessionUser updated = CurrentUser.get().withCompanyName(c.getName());
        SecurityContext ctx = SecurityContextHolder.getContext();
        ctx.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(updated, null,
                SecurityContextHolder.getContext().getAuthentication().getAuthorities()));
        contexts.saveContext(ctx, req, res);
        return Resp.message("Dados da empresa guardados.");
    }

    @PutMapping("/api/settings/logo")
    public Map<String, Object> logo(@RequestBody Dto.Logo body) {
        settings.updateLogo(CurrentUser.manager(), body.logo());
        return Resp.message(body.logo() == null || body.logo().isBlank() ? "Logótipo removido." : "Logótipo guardado.");
    }

    /** Números de WhatsApp/SMS, envio automático e modelos das mensagens (planos Standard e Enterprise). */
    @PutMapping("/api/settings/messaging")
    public Map<String, Object> messaging(@Valid @RequestBody Dto.Messaging body) {
        Long cid = CurrentUser.manager();
        settings.updateMessaging(cid, body);
        return Resp.ok().with("messaging", settings.messagingView(cid)).with("message", "Mensagens configuradas.").build();
    }

    /** Tarifa da empresa: o ecrã de leitura calcula o valor a pagar enquanto se escreve (gestor e mediador). */
    @GetMapping("/api/tariff")
    public Map<String, Object> tariff() {
        return Resp.ok("tariff", settings.tariff(CurrentUser.companyOf(Roles.MANAGER, Roles.READER)));
    }

    @PutMapping("/api/settings/tiers")
    public Map<String, Object> tiers(@Valid @RequestBody Dto.Tiers body) {
        return Resp.ok().with("tiers", settings.replaceTiers(CurrentUser.manager(), body.tiers()))
                .with("message", "Escalões guardados.").build();
    }

    @GetMapping("/api/settings/simulate")
    public Map<String, Object> simulate(@RequestParam int consumption, @RequestParam(required = false) String category) {
        if (consumption < 0 || consumption > 1_000_000) throw ApiException.badRequest("Consumo inválido.");
        TariffCalculator.Result r = settings.simulate(CurrentUser.manager(), consumption, category);
        return Resp.ok("result", r);
    }

    // ---------------- Mediadores ----------------
    @GetMapping("/api/team/readers")
    public Map<String, Object> readers() {
        return Resp.ok("items", team.readers(CurrentUser.manager()));
    }

    @PostMapping("/api/team/readers")
    public Map<String, Object> createReader(@Valid @RequestBody Dto.Reader body) {
        return Resp.ok().withAll(team.create(CurrentUser.manager(), body)).build();
    }

    @PutMapping("/api/team/readers/{id}")
    public Map<String, Object> updateReader(@PathVariable Long id, @Valid @RequestBody Dto.UserUpdate body) {
        team.update(CurrentUser.manager(), id, body);
        return Resp.message("Mediador atualizado.");
    }

    @PostMapping("/api/team/readers/{id}/reset-password")
    public Map<String, Object> resetReader(@PathVariable Long id) {
        return Resp.ok().withAll(team.resetPassword(CurrentUser.manager(), id)).build();
    }

    @DeleteMapping("/api/team/readers/{id}")
    public Map<String, Object> deleteReader(@PathVariable Long id) {
        return Resp.message(team.deleteReader(CurrentUser.manager(), id));
    }

    // ---------------- Acessos dos clientes (portal) ----------------
    @GetMapping("/api/team/customer-users")
    public Map<String, Object> customerUsers(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                             @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return team.customerUsers(CurrentUser.manager(), q, status, page, size);
    }

    @PostMapping("/api/team/customer-users/{id}/status/{status}")
    public Map<String, Object> customerUserStatus(@PathVariable Long id, @PathVariable String status) {
        team.setCustomerUserStatus(CurrentUser.manager(), id, status);
        return Resp.message("blocked".equals(status) ? "Acesso bloqueado." : "Acesso desbloqueado.");
    }

    @PostMapping("/api/team/customer-users/{id}/reset-password")
    public Map<String, Object> customerUserReset(@PathVariable Long id) {
        return Resp.ok().withAll(team.resetCustomerUser(CurrentUser.manager(), id)).build();
    }

    @DeleteMapping("/api/team/customer-users/{id}")
    public Map<String, Object> customerUserDelete(@PathVariable Long id) {
        team.removeCustomerUser(CurrentUser.manager(), id);
        return Resp.message("Acesso ao portal removido (os dados do cliente mantêm-se).");
    }

    // ---------------- Pedidos de recuperação de senha (mediadores e clientes) ----------------
    @GetMapping("/api/team/password-resets")
    public Map<String, Object> teamResets(@RequestParam(required = false) String status) {
        return Resp.ok("items", team.resets(CurrentUser.manager(), status));
    }

    @PostMapping("/api/team/password-resets/{id}/resolve")
    public Map<String, Object> teamResolve(@PathVariable Long id) {
        Long cid = CurrentUser.manager();
        return Resp.ok().withAll(resets.resolveByAdmin(id, CurrentUser.get().id(), cid)).build();
    }

    @PostMapping("/api/team/password-resets/{id}/cancel")
    public Map<String, Object> teamCancel(@PathVariable Long id) {
        resets.cancel(id, CurrentUser.manager());
        return Resp.message("Pedido cancelado.");
    }

    static boolean isManager() {
        return CurrentUser.optional().map(u -> u.is(Roles.MANAGER)).orElse(false);
    }
}
