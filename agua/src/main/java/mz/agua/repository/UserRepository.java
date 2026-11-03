package mz.agua.repository;

import mz.agua.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findFirstByEmailIgnoreCase(String email);

    Optional<User> findFirstByCustomerId(Long customerId);

    Optional<User> findFirstByCompanyIdAndRoleOrderByIdAsc(Long companyId, String role);

    boolean existsByRole(String role);
}
