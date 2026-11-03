package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Codes;
import mz.agua.common.Text;
import mz.agua.domain.User;
import mz.agua.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Criação de contas com senha temporária (trocada obrigatoriamente no 1.º acesso)
 * e validações comuns: email válido e único, nome de utilizador único.
 */
@Component
@RequiredArgsConstructor
public class UserFactory {

    private final UserRepository users;
    private final PasswordEncoder encoder;

    public record Created(User user, String tempPassword) {
    }

    public Created create(Long companyId, Long customerId, String role, String name, String username,
                          String email, String phone) {
        if (users.findByUsernameIgnoreCase(username).isPresent()) throw ApiException.conflict("O utilizador " + username + " já existe.");
        String mail = checkEmail(email, null);
        String temp = Codes.tempPassword();
        User u = new User();
        u.setCompanyId(companyId);
        u.setCustomerId(customerId);
        u.setRole(role);
        u.setName(name);
        u.setUsername(username);
        u.setEmail(mail);
        u.setPhone(Text.clean(phone));
        u.setPassword(encoder.encode(temp));
        u.setMustChangePassword(true);
        u.setStatus("active");
        return new Created(users.saveAndFlush(u), temp);
    }

    /** Email opcional: se vier, tem de ser válido e não pode pertencer a outro utilizador. */
    public String checkEmail(String email, Long exceptUserId) {
        String mail = Text.email(email);
        if (mail == null) return null;
        if (!Text.validEmail(mail)) throw ApiException.badRequest("Email inválido: " + mail);
        users.findFirstByEmailIgnoreCase(mail).ifPresent(other -> {
            if (!other.getId().equals(exceptUserId)) {
                throw ApiException.conflict("O email " + mail + " já está a ser usado por outro utilizador.");
            }
        });
        return mail;
    }

    /** Nova senha temporária (o utilizador é obrigado a trocá-la). */
    public String resetPassword(User u) {
        String temp = Codes.tempPassword();
        u.setPassword(encoder.encode(temp));
        u.setMustChangePassword(true);
        users.save(u);
        return temp;
    }
}
