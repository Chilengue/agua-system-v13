package mz.agua.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Contador da conta (troca de contador mantém histórico). Tabela meters. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "meters")
@Getter
@Setter
@NoArgsConstructor
public class Meter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_meter")
    private Long id;

    @Column(name = "id_company_meter", nullable = false)
    private Long companyId;

    @Column(name = "id_account_meter", nullable = false)
    private Long accountId;

    @Column(name = "number_meter", nullable = false)
    private String number;

    @Column(name = "initial_reading_meter", nullable = false)
    private Integer initialReading = 0;

    @Column(name = "installed_at_meter")
    private LocalDate installedAt;

    @Column(name = "removed_at_meter")
    private LocalDate removedAt;

    @Column(name = "status_meter", nullable = false)
    private String status = "active";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
