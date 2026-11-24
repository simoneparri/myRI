package it.myri.person;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PersonRepository extends JpaRepository<Person, Long>, JpaSpecificationExecutor<Person> {
    boolean existsByMypadId(String mypadId);
    boolean existsByMypadIdAndIdNot(String mypadId, Long id);
    boolean existsByRsnoAgresso(String rsnoAgresso);
    boolean existsByRsnoAgressoAndIdNot(String rsnoAgresso, Long id);
    boolean existsByInsideId(String insideId);
    boolean existsByInsideIdAndIdNot(String insideId, Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Person> findByRsnoAgresso(String rsnoAgresso);

    @Query("select p from Person p order by p.lastName, p.firstName, p.id")
    List<Person> capacityPeople(Pageable pageable);
}
