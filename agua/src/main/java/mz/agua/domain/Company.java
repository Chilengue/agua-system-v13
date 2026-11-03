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

/** Empresa / provedor de água (tenant). code = AGUA-XXXX-XXXX. Tabela companies. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "companies")
@Getter
@Setter
@NoArgsConstructor
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_company")
    private Long id;

    @Column(name = "code_company", nullable = false)
    private String code;

    @Column(name = "name_company", nullable = false)
    private String name;

    @Column(name = "nuit_company")
    private String nuit;

    @Column(name = "phone_company")
    private String phone;

    @Column(name = "email_company")
    private String email;

    @Column(name = "address_company")
    private String address;

    @Column(name = "city_company")
    private String city;

    @Column(name = "province_company")
    private String province;

    @Column(name = "slogan_company")
    private String slogan;

    @JsonIgnore
    @Column(name = "logo_company")
    private String logo;

    @Column(name = "status_company", nullable = false)
    private String status = "pending";

    @Column(name = "self_registered_company", nullable = false)
    private Boolean selfRegistered = false;

    @Column(name = "approved_at_company")
    private LocalDateTime approvedAt;

    @Column(name = "notes_company")
    private String notes;

    @Column(name = "plan_company", nullable = false)
    private String plan = "basic";

    @Column(name = "plan_changed_at_company")
    private LocalDateTime planChangedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
