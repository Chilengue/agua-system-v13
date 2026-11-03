package mz.agua.repository;

import mz.agua.domain.Company;
import org.springframework.data.jpa.repository.JpaRepository;


public interface CompanyRepository extends JpaRepository<Company, Long> {

    boolean existsByCode(String code);
}
