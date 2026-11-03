package mz.agua.repository;

import mz.agua.domain.TariffTier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TariffTierRepository extends JpaRepository<TariffTier, Long> {

    List<TariffTier> findByCompanyIdOrderByCategoryAscFromM3Asc(Long companyId);
}
