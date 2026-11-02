package it.myri.salary;

import java.util.Optional;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface SalaryRepository extends JpaRepository<Salary, Long>, JpaSpecificationExecutor<Salary> {
    Optional<Salary> findBySourceRaiseRequestId(Long id);
    Optional<Salary> findByRequestKey(String key);
    List<Salary> findBySourceRaiseRequestIdIn(Collection<Long> ids);
}
