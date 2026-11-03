package mz.agua.repository;

import mz.agua.domain.PaymentAllocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentAllocationRepository extends JpaRepository<PaymentAllocation, Long> {

    List<PaymentAllocation> findByPaymentIdOrderByIdAsc(Long paymentId);
}
