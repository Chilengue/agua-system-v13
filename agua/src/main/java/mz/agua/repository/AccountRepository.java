package mz.agua.repository;

import mz.agua.domain.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccountRepository extends JpaRepository<Account, Long> {

    List<Account> findByCustomerIdOrderByIdAsc(Long customerId);
}
