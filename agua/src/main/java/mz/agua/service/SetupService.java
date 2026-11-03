package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Text;
import mz.agua.domain.User;
import mz.agua.dto.Dto;
import mz.agua.repository.UserRepository;
import mz.agua.security.Roles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Primeira utilização: cria o administrador da plataforma (só enquanto não existir nenhum). */
@Service
@RequiredArgsConstructor
public class SetupService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final UserFactory userFactory;
    private final AuditService audit;

    public boolean done() {
        return users.existsByRole(Roles.ADMIN);
    }

    @Transactional
    public User createAdmin(Dto.Setup d) {
        if (done()) throw ApiException.forbidden("O administrador já foi criado.");
        if (users.findByUsernameIgnoreCase(d.username().trim()).isPresent()) throw ApiException.conflict("Utilizador já existe.");
        User u = new User();
        u.setRole(Roles.ADMIN);
        u.setName(Text.clean(d.name()));
        u.setUsername(d.username().trim());
        u.setEmail(userFactory.checkEmail(d.email(), null));
        u.setPassword(encoder.encode(d.password()));
        u.setMustChangePassword(false);
        u.setStatus("active");
        u = users.save(u);
        audit.logAs(null, u.getId(), u.getUsername(), "SETUP_ADMIN", "users/" + u.getId(), null);
        return u;
    }
}
