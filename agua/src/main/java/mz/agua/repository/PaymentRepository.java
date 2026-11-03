package mz.agua.repository;

import mz.agua.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByClientUuid(String clientUuid);

    boolean existsByCustomerId(Long customerId);
}
