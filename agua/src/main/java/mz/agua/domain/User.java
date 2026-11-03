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

/** Utilizador. company_id nulo = administrador da plataforma. Email único. Tabela users. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_user")
    private Long id;

    @Column(name = "id_company_user")
    private Long companyId;

    @Column(name = "id_customer_user")
    private Long customerId;

    @Column(name = "name_user", nullable = false)
    private String name;

    @Column(name = "username_user", nullable = false)
    private String username;

    @Column(name = "email_user")
    private String email;

    @Column(name = "phone_user")
    private String phone;

    @JsonIgnore
    @Column(name = "password_user", nullable = false)
    private String password;

    @Column(name = "role_user", nullable = false)
    private String role;

    @Column(name = "status_user", nullable = false)
    private String status = "active";

    @Column(name = "must_change_password_user", nullable = false)
    private Boolean mustChangePassword = false;

    @Column(name = "last_login_user")
    private LocalDateTime lastLogin;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
