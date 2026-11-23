package it.myri.absence;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyClosureRepository extends JpaRepository<CompanyClosure, Long> {
    Optional<CompanyClosure> findByClosedOn(LocalDate date);
    List<CompanyClosure> findByClosedOnGreaterThanEqualAndClosedOnLessThanAndArchivedAtIsNullOrderByClosedOn(
            LocalDate start, LocalDate end);
}
