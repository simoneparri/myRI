package it.myri.raiserequest;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RaiseRequestRepository extends JpaRepository<RaiseRequest, Long>, JpaSpecificationExecutor<RaiseRequest> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RaiseRequest r where r.id = :id")
    Optional<RaiseRequest> lockById(@Param("id") Long id);
}
