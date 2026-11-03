package mz.agua.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Fatura de uma conta (consumo ou manual). Tabela invoices. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_invoice")
    private Long id;

    @Column(name = "id_company_invoice", nullable = false)
    private Long companyId;

    @Column(name = "id_customer_invoice", nullable = false)
    private Long customerId;

    @Column(name = "id_account_invoice", nullable = false)
    private Long accountId;

    @Column(name = "id_reading_invoice")
    private Long readingId;

    @Column(name = "kind_invoice", nullable = false)
    private String kind = "consumption";

    @Column(name = "number_invoice", nullable = false)
    private String number;

    @Column(name = "period_invoice", nullable = false)
    private String period;

    @Column(name = "description_invoice")
    private String description;

    @Column(name = "previous_value_invoice")
    private Integer previousValue;

    @Column(name = "current_value_invoice")
    private Integer currentValue;

    @Column(name = "consumption_invoice", nullable = false)
    private Integer consumption = 0;

    @Column(name = "water_amount_invoice", nullable = false)
    private BigDecimal waterAmount = BigDecimal.ZERO;

    @Column(name = "sewer_amount_invoice", nullable = false)
    private BigDecimal sewerAmount = BigDecimal.ZERO;

    @Column(name = "fixed_fee_invoice", nullable = false)
    private BigDecimal fixedFee = BigDecimal.ZERO;

    @Column(name = "other_amount_invoice", nullable = false)
    private BigDecimal otherAmount = BigDecimal.ZERO;

    @Column(name = "fine_amount_invoice", nullable = false)
    private BigDecimal fineAmount = BigDecimal.ZERO;

    @Column(name = "interest_amount_invoice", nullable = false)
    private BigDecimal interestAmount = BigDecimal.ZERO;

    @Column(name = "discount_invoice", nullable = false)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(name = "total_invoice", nullable = false)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "paid_amount_invoice", nullable = false)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "status_invoice", nullable = false)
    private String status = "open";

    @Column(name = "issue_date_invoice", nullable = false)
    private LocalDate issueDate;

    @Column(name = "due_date_invoice", nullable = false)
    private LocalDate dueDate;

    @Column(name = "paid_at_invoice")
    private LocalDate paidAt;

    @Column(name = "last_charge_date_invoice")
    private LocalDate lastChargeDate;

    @Column(name = "notes_invoice")
    private String notes;

    @Column(name = "cancel_reason_invoice")
    private String cancelReason;

    @Column(name = "id_user_invoice")
    private Long userId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
