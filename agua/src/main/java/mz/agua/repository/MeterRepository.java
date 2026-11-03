package mz.agua.repository;

import mz.agua.domain.Meter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface MeterRepository extends JpaRepository<Meter, Long> {

    Optional<Meter> findFirstByAccountIdAndStatus(Long accountId, String status);

    List<Meter> findByAccountId(Long accountId);
}
