package mz.agua.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
import org.hibernate.annotations.UpdateTimestamp;

/** Pedido de recuperação de senha (código por email ou tratado pelo admin). Tabela password_resets. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "password_resets")
@Getter
@Setter
@NoArgsConstructor
public class PasswordReset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_password_reset")
    private Long id;

    @Column(name = "id_user_password_reset", nullable = false)
    private Long userId;

    @JsonIgnore
    @Column(name = "code_hash_password_reset", nullable = false)
    private String codeHash;

    @Column(name = "expires_at_password_reset", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at_password_reset")
    private LocalDateTime usedAt;

    @Column(name = "channel_password_reset", nullable = false)
    private String channel;

    @Column(name = "status_password_reset", nullable = false)
    private String status = "pending";

    @Column(name = "attempts_password_reset", nullable = false)
    private Integer attempts = 0;

    @Column(name = "ip_password_reset")
    private String ip;

    @Column(name = "handled_by_password_reset")
    private Long handledBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
