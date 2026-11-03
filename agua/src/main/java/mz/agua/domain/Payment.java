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

/** Pagamento (total ou parcial) com recibo; pode cobrir várias faturas. Tabela payments. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_payment")
    private Long id;

    @Column(name = "id_company_payment", nullable = false)
    private Long companyId;

    @Column(name = "id_customer_payment", nullable = false)
    private Long customerId;

    @Column(name = "receipt_number_payment", nullable = false)
    private String receiptNumber;

    @Column(name = "amount_payment", nullable = false)
    private BigDecimal amount;

    @Column(name = "method_payment", nullable = false)
    private String method = "cash";

    @Column(name = "reference_payment")
    private String reference;

    @Column(name = "paid_at_payment", nullable = false)
    private LocalDateTime paidAt;

    @Column(name = "client_uuid_payment")
    private String clientUuid;

    @Column(name = "status_payment", nullable = false)
    private String status = "confirmed";

    @Column(name = "notes_payment")
    private String notes;

    @Column(name = "id_user_payment")
    private Long userId;

    @Column(name = "validated_by_payment")
    private Long validatedBy;

    @Column(name = "validated_at_payment")
    private LocalDateTime validatedAt;

    @Column(name = "voided_by_payment")
    private Long voidedBy;

    @Column(name = "voided_at_payment")
    private LocalDateTime voidedAt;

    @Column(name = "void_reason_payment")
    private String voidReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
