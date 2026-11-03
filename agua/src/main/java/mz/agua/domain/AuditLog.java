package mz.agua.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Quem fez o quê e quando. Tabela audit_logs. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_audit_log")
    private Long id;

    @Column(name = "id_company_audit_log")
    private Long companyId;

    @Column(name = "id_user_audit_log")
    private Long userId;

    @Column(name = "username_audit_log")
    private String username;

    @Column(name = "action_audit_log", nullable = false)
    private String action;

    @Column(name = "resource_audit_log")
    private String resource;

    @Column(name = "payload_audit_log")
    private String payload;

    @Column(name = "ip_audit_log")
    private String ip;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
