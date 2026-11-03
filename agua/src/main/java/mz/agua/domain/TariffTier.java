package mz.agua.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Escalão de preço por m3 (to_m3 nulo = sem limite). Tabela tariff_tiers. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "tariff_tiers")
@Getter
@Setter
@NoArgsConstructor
public class TariffTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_tariff_tier")
    private Long id;

    @Column(name = "id_company_tariff_tier", nullable = false)
    private Long companyId;

    @Column(name = "category_tariff_tier", nullable = false)
    private String category = "residential";

    @Column(name = "from_m3_tariff_tier", nullable = false)
    private Integer fromM3;

    @Column(name = "to_m3_tariff_tier")
    private Integer toM3;

    @Column(name = "price_m3_tariff_tier", nullable = false)
    private BigDecimal priceM3;

    @Column(name = "description_tariff_tier")
    private String description;

    @Column(name = "active_tariff_tier", nullable = false)
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
