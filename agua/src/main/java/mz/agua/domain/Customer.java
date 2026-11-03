package mz.agua.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

/** Cliente. Não se repete na mesma empresa (documento ou telefone). Tabela customers. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_customer")
    private Long id;

    @Column(name = "id_company_customer", nullable = false)
    private Long companyId;

    @Column(name = "code_customer", nullable = false)
    private String code;

    @Column(name = "name_customer", nullable = false)
    private String name;

    @JsonIgnore
    @Column(name = "name_key_customer", nullable = false)
    private String nameKey;

    @Column(name = "document_type_customer", nullable = false)
    private String documentType = "bi";

    @Column(name = "document_customer")
    private String document;

    @Column(name = "nuit_customer")
    private String nuit;

    @Column(name = "gender_customer")
    private String gender;

    @Column(name = "birth_date_customer")
    private LocalDate birthDate;

    @Column(name = "occupation_customer")
    private String occupation;

    @Column(name = "phone_customer")
    private String phone;

    @JsonIgnore
    @Column(name = "phone_key_customer")
    private String phoneKey;

    @Column(name = "phone2_customer")
    private String phone2;

    @Column(name = "email_customer")
    private String email;

    @Column(name = "address_customer")
    private String address;

    @Column(name = "neighborhood_customer")
    private String neighborhood;

    @Column(name = "block_customer")
    private String block;

    @Column(name = "house_number_customer")
    private String houseNumber;

    @Column(name = "district_customer")
    private String district;

    @Column(name = "city_customer")
    private String city;

    @Column(name = "status_customer", nullable = false)
    private String status = "active";

    @Column(name = "notes_customer")
    private String notes;

    @Column(name = "client_uuid_customer")
    private String clientUuid;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
