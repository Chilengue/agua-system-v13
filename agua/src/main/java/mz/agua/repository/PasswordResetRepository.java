package mz.agua.repository;

import mz.agua.domain.PasswordReset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {

    List<PasswordReset> findByUserIdAndStatus(Long userId, String status);
}
