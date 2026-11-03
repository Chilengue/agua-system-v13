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
import org.hibernate.annotations.UpdateTimestamp;

/** Mensagem WhatsApp/SMS enviada (ou preparada) para um cliente. Tabela messages. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_message")
    private Long id;

    @Column(name = "id_company_message", nullable = false)
    private Long companyId;

    @Column(name = "id_customer_message")
    private Long customerId;

    @Column(name = "channel_message", nullable = false)
    private String channel;

    @Column(name = "kind_message", nullable = false)
    private String kind = "custom";

    @Column(name = "id_ref_message")
    private Long refId;

    @Column(name = "to_phone_message", nullable = false)
    private String toPhone;

    @Column(name = "body_message", nullable = false)
    private String body;

    @Column(name = "status_message", nullable = false)
    private String status = "queued";

    @Column(name = "attempts_message", nullable = false)
    private Integer attempts = 0;

    @Column(name = "error_message")
    private String error;

    @Column(name = "provider_ref_message")
    private String providerRef;

    @Column(name = "sent_at_message")
    private LocalDateTime sentAt;

    @Column(name = "id_user_message")
    private Long userId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
