package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Codes;
import mz.agua.common.Text;
import mz.agua.config.AppProperties;
import mz.agua.domain.PasswordReset;
import mz.agua.domain.User;
import mz.agua.repository.PasswordResetRepository;
import mz.agua.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Recuperação de senha: o utilizador indica o EMAIL e o NOME COMPLETO usados no registo.
 * - Com email configurado: recebe um código de 6 dígitos (válido 30 minutos, 5 tentativas).
 * - Sem email configurado: o pedido aparece no painel do administrador, que gera uma senha temporária.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final int MINUTES = 30;
    private static final int MAX_ATTEMPTS = 5;

    private final UserRepository users;
    private final PasswordResetRepository resets;
    private final PasswordEncoder encoder;
    private final MailService mail;
    private final AuditService audit;
    private final UserFactory userFactory;
    private final AppProperties props;

    @Transactional
    public Map<String, Object> request(String email, String name, String ip) {
        User u = users.findFirstByEmailIgnoreCase(Text.email(email)).orElse(null);
        if (u == null || !Text.key(u.getName()).equals(Text.key(name))) {
            throw ApiException.badRequest("O email e o nome não correspondem a nenhuma conta. Use os dados do registo "
                    + "ou peça ao administrador para atualizar os seus dados.");
        }
        // pedidos antigos deixam de valer
        for (PasswordReset old : resets.findByUserIdAndStatus(u.getId(), "pending")) {
            old.setStatus("cancelled");
            resets.save(old);
        }
        String code = Codes.numeric(6);
        PasswordReset r = new PasswordReset();
        r.setUserId(u.getId());
        r.setCodeHash(encoder.encode(code));
        r.setExpiresAt(LocalDateTime.now().plusMinutes(MINUTES));
        r.setIp(ip);
        r.setStatus("pending");
        r.setAttempts(0);

        Map<String, Object> out = new LinkedHashMap<>();
        boolean sent = mail.enabled() && mail.send(u.getEmail(), "AguaSystem — código de recuperação de senha",
                "Olá " + u.getName() + ",\n\nO seu código para criar uma nova senha é: " + code
                        + "\nO código é válido durante " + MINUTES + " minutos.\n\nUtilizador: " + u.getUsername()
                        + "\n\nSe não pediu esta alteração, ignore este email.");
        if (sent || props.devShowResetCode()) {
            r.setChannel("email");
            out.put("channel", "email");
            out.put("message", sent ? "Enviámos um código de 6 dígitos para " + Text.maskEmail(u.getEmail()) + "."
                    : "Modo de teste: use o código indicado.");
            if (props.devShowResetCode()) out.put("dev_code", code);
        } else {
            r.setChannel("admin");
            out.put("channel", "admin");
            boolean staff = "manager".equals(u.getRole()) || "admin".equals(u.getRole());
            out.put("message", staff
                    ? "Pedido registado. O administrador vai gerar uma senha temporária para si. "
                      + "Contacte o suporte " + (props.supportPhone() == null ? "" : props.supportPhone()) + "."
                    : "Pedido registado. O gestor da sua empresa de água vai gerar uma senha temporária para si.");
        }
        resets.save(r);
        audit.logAs(u.getCompanyId(), u.getId(), u.getUsername(), "PASSWORD_RESET_REQUEST", "users/" + u.getId(), r.getChannel());
        return out;
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void reset(String email, String code, String newPassword) {
        AuthService.validatePassword(newPassword);
        User u = users.findFirstByEmailIgnoreCase(Text.email(email))
                .orElseThrow(() -> ApiException.badRequest("Código inválido ou expirado."));
        List<PasswordReset> pending = resets.findByUserIdAndStatus(u.getId(), "pending");
        PasswordReset r = pending.stream().filter(x -> "email".equals(x.getChannel())).findFirst()
                .orElseThrow(() -> ApiException.badRequest("Código inválido ou expirado. Peça um novo código."));
        if (r.getExpiresAt().isBefore(LocalDateTime.now()) || r.getAttempts() >= MAX_ATTEMPTS) {
            r.setStatus("expired");
            resets.save(r);
            throw ApiException.badRequest("O código expirou. Peça um novo código.");
        }
        if (!encoder.matches(code == null ? "" : code.trim(), r.getCodeHash())) {
            r.setAttempts(r.getAttempts() + 1);
            resets.save(r);
            throw ApiException.badRequest("Código incorreto. Tentativas restantes: " + (MAX_ATTEMPTS - r.getAttempts()) + ".");
        }
        if ("blocked".equals(u.getStatus())) throw ApiException.forbidden("Conta bloqueada. Contacte o suporte.");
        u.setPassword(encoder.encode(newPassword));
        u.setMustChangePassword(false);
        users.save(u);
        r.setStatus("done");
        r.setUsedAt(LocalDateTime.now());
        resets.save(r);
        audit.logAs(u.getCompanyId(), u.getId(), u.getUsername(), "PASSWORD_RESET_DONE", "users/" + u.getId(), "email");
    }

    /**
     * Trata um pedido: gera senha temporária para entregar ao utilizador.
     * companyId null = administrador (só gestores/admins); com empresa = gestor (só mediadores e clientes dessa empresa).
     */
    @Transactional
    public Map<String, Object> resolveByAdmin(Long resetId, Long adminId, Long companyId) {
        PasswordReset r = resets.findById(resetId).orElseThrow(() -> ApiException.notFound("Pedido não encontrado."));
        if (!"pending".equals(r.getStatus())) throw ApiException.badRequest("Este pedido já foi tratado.");
        User u = users.findById(r.getUserId()).orElseThrow(() -> ApiException.notFound("Utilizador não encontrado."));
        checkScope(u, companyId);
        String temp = userFactory.resetPassword(u);
        r.setStatus("done");
        r.setUsedAt(LocalDateTime.now());
        r.setHandledBy(adminId);
        resets.save(r);
        audit.log("PASSWORD_RESET_ADMIN", "users/" + u.getId(), null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("username", u.getUsername());
        out.put("name", u.getName());
        out.put("phone", u.getPhone());
        out.put("temp_password", temp);
        return out;
    }

    @Transactional
    public void cancel(Long resetId, Long companyId) {
        PasswordReset r = resets.findById(resetId).orElseThrow(() -> ApiException.notFound("Pedido não encontrado."));
        checkScope(users.findById(r.getUserId()).orElseThrow(() -> ApiException.notFound("Utilizador não encontrado.")), companyId);
        r.setStatus("cancelled");
        resets.save(r);
    }

    private static void checkScope(User u, Long companyId) {
        boolean staff = "manager".equals(u.getRole()) || "admin".equals(u.getRole());
        if (companyId == null ? !staff : staff || !java.util.Objects.equals(u.getCompanyId(), companyId)) {
            throw ApiException.notFound("Pedido não encontrado.");
        }
    }
}
