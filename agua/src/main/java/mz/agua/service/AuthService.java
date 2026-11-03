package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.config.AppProperties;
import mz.agua.domain.Company;
import mz.agua.domain.User;
import mz.agua.repository.CompanyRepository;
import mz.agua.repository.UserRepository;
import mz.agua.security.CurrentUser;
import mz.agua.security.Roles;
import mz.agua.security.SessionUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;

/** Login (utilizador/código ou email), troca de senha e revalidação da sessão. */
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String INVALID = "Utilizador ou senha incorretos.";
    /** Hash fixo para que um utilizador inexistente demore o mesmo tempo a responder. */
    private static final String DUMMY = "$2a$10$apLtrnKviZw2bGXDRPrEsOvmOAs3Zz.G6ON2QG3jZUVZexGZ867Ke";

    private final UserRepository users;
    private final CompanyRepository companies;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final AppProperties props;

    @Transactional
    public SessionUser authenticate(String login, String password) {
        String l = login == null ? "" : login.trim();
        Optional<User> found = users.findByUsernameIgnoreCase(l).or(() -> users.findFirstByEmailIgnoreCase(l));
        if (found.isEmpty()) {
            encoder.matches(password, DUMMY);
            throw ApiException.unauthorized(INVALID);
        }
        User u = found.get();
        if (!encoder.matches(password, u.getPassword())) {
            audit.logAs(u.getCompanyId(), u.getId(), u.getUsername(), "LOGIN_FAILED", "auth", null);
            throw ApiException.unauthorized(INVALID);
        }
        if (!"active".equals(u.getStatus())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Conta bloqueada. Contacte o gestor ou o suporte " + support() + ".");
        }
        Company c = null;
        if (!Roles.ADMIN.equals(u.getRole())) {
            c = companies.findById(u.getCompanyId())
                    .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Empresa não encontrada."));
            switch (c.getStatus()) {
                case "active" -> { }
                case "pending" -> throw new ApiException(HttpStatus.FORBIDDEN,
                        "A empresa \"" + c.getName() + "\" está pendente de aprovação. Para acelerar: " + support() + ".");
                case "rejected" -> throw new ApiException(HttpStatus.FORBIDDEN,
                        "O registo da empresa \"" + c.getName() + "\" foi rejeitado. Contacte o suporte " + support() + ".");
                default -> throw new ApiException(HttpStatus.FORBIDDEN,
                        "A empresa \"" + c.getName() + "\" está suspensa. Contacte o suporte " + support() + ".");
            }
        }
        u.setLastLogin(LocalDateTime.now());
        users.save(u);
        audit.logAs(u.getCompanyId(), u.getId(), u.getUsername(), "LOGIN", "auth", null);
        return toSession(u, c);
    }

    public SessionUser toSession(User u, Company c) {
        return new SessionUser(u.getId(), u.getUsername(), u.getName(), u.getEmail(), u.getRole(), u.getCompanyId(),
                c == null ? null : c.getCode(), c == null ? null : c.getName(), u.getCustomerId(),
                Boolean.TRUE.equals(u.getMustChangePassword()), Instant.now());
    }

    @Transactional
    public void changePassword(String current, String next) {
        SessionUser me = CurrentUser.get();
        User u = users.findById(me.id()).orElseThrow(() -> ApiException.notFound("Utilizador não encontrado."));
        if (!encoder.matches(current == null ? "" : current, u.getPassword())) throw ApiException.badRequest("Senha atual incorreta.");
        validatePassword(next);
        if (encoder.matches(next, u.getPassword())) throw ApiException.badRequest("A nova senha tem de ser diferente da atual.");
        u.setPassword(encoder.encode(next));
        u.setMustChangePassword(false);
        users.save(u);
        audit.log("PASSWORD_CHANGED", "users/" + u.getId(), null);
    }

    @Transactional(readOnly = true)
    public boolean stillValid(SessionUser s) {
        Optional<User> u = users.findById(s.id());
        if (u.isEmpty() || !"active".equals(u.get().getStatus())) return false;
        if (s.companyId() == null) return Roles.ADMIN.equals(s.role());
        return companies.findById(s.companyId()).map(c -> "active".equals(c.getStatus())).orElse(false);
    }

    public static void validatePassword(String p) {
        if (p == null || p.length() < 6) throw ApiException.badRequest("A senha deve ter pelo menos 6 caracteres.");
        if (p.length() > 72) throw ApiException.badRequest("A senha é demasiado longa (máximo 72 caracteres).");
    }

    private String support() {
        return props.supportPhone() == null ? "" : props.supportPhone()
                + (props.supportName() == null || props.supportName().isBlank() ? "" : " (" + props.supportName() + ")");
    }
}
