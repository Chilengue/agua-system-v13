package mz.agua.service;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import mz.agua.domain.AuditLog;
import mz.agua.repository.AuditLogRepository;
import mz.agua.security.ClientIp;
import mz.agua.security.CurrentUser;
import mz.agua.security.SessionUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Auditoria: quem fez o quê e quando. Grava numa transação própria (fica registado mesmo que a
 * operação falhe depois) e uma falha aqui nunca interrompe a operação principal.
 */
@Slf4j
@Service
public class AuditService {

    private final AuditLogRepository repo;
    private final TransactionTemplate tx;

    public AuditService(AuditLogRepository repo, PlatformTransactionManager tm) {
        this.repo = repo;
        this.tx = new TransactionTemplate(tm);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void log(String action, String resource, String payload) {
        SessionUser u = CurrentUser.optional().orElse(null);
        logAs(u == null ? null : u.companyId(), u == null ? null : u.id(), u == null ? null : u.username(),
                action, resource, payload);
    }

    public void logAs(Long companyId, Long userId, String username, String action, String resource, String payload) {
        try {
            AuditLog a = new AuditLog();
            a.setCompanyId(companyId);
            a.setUserId(userId);
            a.setUsername(username);
            a.setAction(action);
            a.setResource(resource);
            a.setPayload(payload == null || payload.length() < 2000 ? payload : payload.substring(0, 2000));
            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
                HttpServletRequest req = attrs.getRequest();
                a.setIp(ClientIp.of(req));
            }
            tx.executeWithoutResult(s -> repo.save(a));
        } catch (RuntimeException e) {
            log.warn("Falha ao gravar auditoria {}: {}", action, e.getMessage());
        }
    }
}
