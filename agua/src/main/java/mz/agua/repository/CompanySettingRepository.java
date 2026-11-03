package mz.agua.repository;

import mz.agua.domain.CompanySetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompanySettingRepository extends JpaRepository<CompanySetting, Long> {

    Optional<CompanySetting> findByCompanyId(Long companyId);
}
