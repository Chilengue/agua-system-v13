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

/** Parte de um pagamento aplicada a uma fatura. Tabela payment_allocations. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "payment_allocations")
@Getter
@Setter
@NoArgsConstructor
public class PaymentAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_payment_allocation")
    private Long id;

    @Column(name = "id_company_payment_allocation", nullable = false)
    private Long companyId;

    @Column(name = "id_payment_payment_allocation", nullable = false)
    private Long paymentId;

    @Column(name = "id_invoice_payment_allocation", nullable = false)
    private Long invoiceId;

    @Column(name = "id_account_payment_allocation", nullable = false)
    private Long accountId;

    @Column(name = "amount_payment_allocation", nullable = false)
    private BigDecimal amount;

    @Column(name = "balance_before_payment_allocation", nullable = false)
    private BigDecimal balanceBefore = BigDecimal.ZERO;

    @Column(name = "balance_after_payment_allocation", nullable = false)
    private BigDecimal balanceAfter = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
