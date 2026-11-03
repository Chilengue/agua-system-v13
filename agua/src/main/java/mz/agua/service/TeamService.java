package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Periods;
import mz.agua.common.Q;
import mz.agua.common.Text;
import mz.agua.domain.Company;
import mz.agua.domain.User;
import mz.agua.dto.Dto;
import mz.agua.repository.CompanyRepository;
import mz.agua.repository.UserRepository;
import mz.agua.security.Roles;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Utilizadores geridos pelo gestor da empresa:
 * <ul>
 *   <li>mediadores (leitores de contadores): criar, editar, bloquear, nova senha e apagar
 *       (um mediador com leituras não se apaga — fica bloqueado para manter o histórico);</li>
 *   <li>acessos ao portal dos clientes: bloquear/desbloquear, nova senha, remover o acesso;</li>
 *   <li>pedidos de recuperação de senha de mediadores e clientes.</li>
 * </ul>
 * O administrador da plataforma só gere os gestores.
 */
@Service
@RequiredArgsConstructor
public class TeamService {

    private final UserRepository users;
    private final CompanyRepository companies;
    private final UserFactory userFactory;
    private final SequenceService seq;
    private final AuditService audit;
    private final Db db;

    public List<Map<String, Object>> readers(Long cid) {
        return db.list("team.readers", Q.company(cid).period(Periods.current()).map());
    }

    @Transactional
    public Map<String, Object> create(Long cid, Dto.Reader d) {
        Company c = companies.findById(cid).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
        String username = seq.readerUsername(cid, c.getCode());
        UserFactory.Created r = userFactory.create(cid, null, Roles.READER, Text.clean(d.name()), username, d.email(), d.phone());
        audit.log("READER_CREATE", "users/" + r.user().getId(), username);
        return credentials(r.user(), r.tempPassword());
    }

    @Transactional
    public void update(Long cid, Long id, Dto.UserUpdate d) {
        User u = reader(cid, id);
        u.setName(Text.clean(d.name()));
        u.setEmail(userFactory.checkEmail(d.email(), u.getId()));
        u.setPhone(Text.clean(d.phone()));
        if (d.status() != null && !d.status().isBlank()) u.setStatus(d.status());
        users.save(u);
        audit.log("READER_UPDATE", "users/" + id, null);
    }

    @Transactional
    public Map<String, Object> resetPassword(Long cid, Long id) {
        User u = reader(cid, id);
        String temp = userFactory.resetPassword(u);
        audit.log("READER_PASSWORD_RESET", "users/" + id, null);
        return credentials(u, temp);
    }

    /** Apaga o mediador; se já registou leituras fica só bloqueado (as leituras guardam quem as fez). */
    @Transactional
    public String deleteReader(Long cid, Long id) {
        User u = reader(cid, id);
        Long count = db.longValue("SELECT COUNT(*) FROM readings WHERE id_user_reading = :id", Map.of("id", id));
        if (count != null && count > 0) {
            u.setStatus("blocked");
            users.save(u);
            audit.log("READER_BLOCK", "users/" + id, u.getUsername() + " (tem " + count + " leituras)");
            return "O mediador tem " + count + " leitura(s) registada(s): foi bloqueado e o histórico mantém-se.";
        }
        db.update("DELETE FROM password_resets WHERE id_user_password_reset = :id", Map.of("id", id));
        users.delete(u);
        audit.log("READER_DELETE", "users/" + id, u.getUsername() + " " + u.getName());
        return "Mediador apagado.";
    }

    // ---------------- Acessos dos clientes ao portal ----------------
    public Map<String, Object> customerUsers(Long cid, String q, String status, Integer page, Integer size) {
        return db.page("team.customer_users", Q.company(cid).search(q).str("status", status).paging(page, size));
    }

    @Transactional
    public void setCustomerUserStatus(Long cid, Long id, String status) {
        if (!"active".equals(status) && !"blocked".equals(status)) throw ApiException.badRequest("Estado inválido.");
        User u = customerUser(cid, id);
        u.setStatus(status);
        users.save(u);
        audit.log("CUSTOMER_ACCESS_" + status.toUpperCase(), "users/" + id, u.getUsername());
    }

    @Transactional
    public Map<String, Object> resetCustomerUser(Long cid, Long id) {
        User u = customerUser(cid, id);
        u.setStatus("active");
        String temp = userFactory.resetPassword(u);
        audit.log("CUSTOMER_ACCESS_RESET", "users/" + id, u.getUsername());
        return credentials(u, temp);
    }

    /** Remove só o acesso ao portal; o cliente, as contas, faturas e pagamentos ficam intactos. */
    @Transactional
    public void removeCustomerUser(Long cid, Long id) {
        User u = customerUser(cid, id);
        db.update("DELETE FROM password_resets WHERE id_user_password_reset = :id", Map.of("id", id));
        users.delete(u);
        audit.log("CUSTOMER_ACCESS_DELETE", "users/" + id, u.getUsername());
    }

    private User customerUser(Long cid, Long id) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("Acesso não encontrado."));
        if (!Objects.equals(u.getCompanyId(), cid) || !Roles.CUSTOMER.equals(u.getRole())) {
            throw ApiException.notFound("Acesso não encontrado.");
        }
        return u;
    }

    // ---------------- Pedidos de senha (mediadores e clientes) ----------------
    public List<Map<String, Object>> resets(Long cid, String status) {
        return db.list("team.resets", Q.company(cid).str("status", status).limit(200).map());
    }

    private User reader(Long cid, Long id) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("Mediador não encontrado."));
        if (!Objects.equals(u.getCompanyId(), cid) || !Roles.READER.equals(u.getRole())) {
            throw ApiException.notFound("Mediador não encontrado.");
        }
        return u;
    }

    static Map<String, Object> credentials(User u, String temp) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("name", u.getName());
        m.put("username", u.getUsername());
        m.put("temp_password", temp);
        return m;
    }
}
