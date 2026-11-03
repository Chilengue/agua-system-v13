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

/** Conta / contrato de água de um cliente (um cliente pode ter várias). Tabela accounts. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_account")
    private Long id;

    @Column(name = "id_company_account", nullable = false)
    private Long companyId;

    @Column(name = "id_customer_account", nullable = false)
    private Long customerId;

    @Column(name = "number_account", nullable = false)
    private String number;

    @Column(name = "category_account", nullable = false)
    private String category = "residential";

    @Column(name = "address_account")
    private String address;

    @Column(name = "neighborhood_account")
    private String neighborhood;

    @Column(name = "block_account")
    private String block;

    @Column(name = "house_number_account")
    private String houseNumber;

    @Column(name = "landmark_account")
    private String landmark;

    @Column(name = "gps_account")
    private String gps;

    @Column(name = "latitude_account")
    private String latitude;

    @Column(name = "longitude_account")
    private String longitude;

    @Column(name = "status_account", nullable = false)
    private String status = "active";

    @Column(name = "opened_at_account")
    private LocalDate openedAt;

    @Column(name = "notes_account")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
