package mz.agua.repository;

import mz.agua.domain.Reading;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface ReadingRepository extends JpaRepository<Reading, Long> {

    Optional<Reading> findByClientUuid(String clientUuid);

    List<Reading> findByAccountId(Long accountId);
}
