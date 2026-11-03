package mz.agua.security;

import mz.agua.common.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;

/**
 * Utilizador da sessão + regras de acesso:
 * require(...) exige um dos perfis; companyId() empresa do utilizador; checkCompany garante isolamento.
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Optional<SessionUser> optional() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof SessionUser u ? Optional.of(u) : Optional.empty();
    }

    public static SessionUser get() {
        return optional().orElseThrow(() -> ApiException.unauthorized("Sessão expirada. Entre novamente."));
    }

    public static SessionUser require(String... roles) {
        SessionUser u = get();
        if (u.mustChangePassword()) throw ApiException.forbidden("Altere a senha temporária antes de continuar.");
        if (Arrays.stream(roles).noneMatch(u::is)) throw ApiException.forbidden();
        return u;
    }

    /** Gestor (ou mediador) — devolve a empresa da sessão. */
    public static Long companyOf(String... roles) {
        SessionUser u = require(roles);
        if (u.companyId() == null) throw ApiException.forbidden("Utilizador sem empresa associada.");
        return u.companyId();
    }

    public static Long manager() {
        return companyOf(Roles.MANAGER);
    }

    public static void admin() {
        require(Roles.ADMIN);
    }

    public static void checkCompany(Long recordCompanyId, Long companyId) {
        if (!Objects.equals(recordCompanyId, companyId)) throw ApiException.notFound("Registo não encontrado.");
    }
}
