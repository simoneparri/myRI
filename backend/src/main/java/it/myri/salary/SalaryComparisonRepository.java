package it.myri.salary;

import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface SalaryComparisonRepository extends Repository<Salary, Long> {
    String CURRENT = """
            from Person p join Salary s on s.personId = p.id
            where s.effectiveOn <= :today
              and (:includeArchived = true or (p.archivedAt is null and p.status = 'active'))
              and not exists (select 1 from Salary n where n.personId = s.personId and n.effectiveOn <= :today
                  and (n.effectiveOn > s.effectiveOn or (n.effectiveOn = s.effectiveOn and n.id > s.id)))
            """;

    /** Returns [Person, Salary] pairs with the latest salary effective on or before today. */
    @Query(value = "select p, s " + CURRENT, countQuery = "select count(s) " + CURRENT)
    Page<Object[]> current(@Param("today") LocalDate today,
            @Param("includeArchived") boolean includeArchived, Pageable pageable);
}
