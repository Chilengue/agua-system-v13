package mz.agua.repository;

import mz.agua.domain.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findFirstByReadingIdAndStatusNot(Long readingId, String status);

    boolean existsByCustomerId(Long customerId);

    boolean existsByAccountId(Long accountId);
}
