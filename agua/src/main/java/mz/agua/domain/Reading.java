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

/** Leitura mensal. client_uuid evita duplicados vindos do modo offline. Tabela readings. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "readings")
@Getter
@Setter
@NoArgsConstructor
public class Reading {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_reading")
    private Long id;

    @Column(name = "id_company_reading", nullable = false)
    private Long companyId;

    @Column(name = "id_account_reading", nullable = false)
    private Long accountId;

    @Column(name = "id_meter_reading", nullable = false)
    private Long meterId;

    @Column(name = "id_customer_reading", nullable = false)
    private Long customerId;

    @Column(name = "period_reading", nullable = false)
    private String period;

    @Column(name = "previous_value_reading", nullable = false)
    private Integer previousValue;

    @Column(name = "current_value_reading", nullable = false)
    private Integer currentValue;

    @Column(name = "consumption_reading", nullable = false)
    private Integer consumption;

    @Column(name = "read_at_reading", nullable = false)
    private LocalDateTime readAt;

    @Column(name = "status_reading", nullable = false)
    private String status = "pending";

    @Column(name = "source_reading", nullable = false)
    private String source = "online";

    @Column(name = "client_uuid_reading")
    private String clientUuid;

    @Column(name = "anomaly_reading", nullable = false)
    private Boolean anomaly = false;

    @Column(name = "notes_reading")
    private String notes;

    @Column(name = "id_user_reading")
    private Long userId;

    @Column(name = "edited_by_reading")
    private Long editedBy;

    @Column(name = "edited_at_reading")
    private LocalDateTime editedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
