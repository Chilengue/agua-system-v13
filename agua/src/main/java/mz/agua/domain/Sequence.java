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

/** Numeração por empresa (faturas, recibos, clientes, contas, mediadores). Tabela sequences. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "sequences")
@Getter
@Setter
@NoArgsConstructor
public class Sequence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_sequence")
    private Long id;

    @Column(name = "id_company_sequence", nullable = false)
    private Long companyId;

    @Column(name = "name_sequence", nullable = false)
    private String name;

    @Column(name = "year_sequence", nullable = false)
    private Integer year;

    @Column(name = "value_sequence", nullable = false)
    private Long value = 0L;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
