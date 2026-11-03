package mz.agua.repository;

import mz.agua.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;


public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Optional<Customer> findByClientUuid(String clientUuid);
}
