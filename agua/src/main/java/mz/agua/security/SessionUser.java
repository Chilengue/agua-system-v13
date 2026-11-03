package mz.agua.security;

import java.io.Serializable;
import java.time.Instant;

/** Utilizador autenticado guardado na sessão. companyId e customerId vêm SEMPRE daqui, nunca do pedido. */
public record SessionUser(Long id, String username, String name, String email, String role, Long companyId,
                          String companyCode, String companyName, Long customerId, boolean mustChangePassword,
                          Instant loginTime) implements Serializable {

    public boolean is(String r) {
        return role.equals(r);
    }

    public String authority() {
        return "ROLE_" + role.toUpperCase();
    }

    public SessionUser withPasswordChanged() {
        return new SessionUser(id, username, name, email, role, companyId, companyCode, companyName, customerId, false, loginTime);
    }

    public SessionUser withCompanyName(String newName) {
        return new SessionUser(id, username, name, email, role, companyId, companyCode, newName, customerId, mustChangePassword, loginTime);
    }

    /** Página inicial de cada perfil. */
    public String home() {
        if (mustChangePassword) return "/change-password";
        return switch (role) {
            case Roles.ADMIN -> "/admin";
            case Roles.MANAGER -> "/dashboard";
            case Roles.READER -> "/reader";
            default -> "/portal";
        };
    }
}
