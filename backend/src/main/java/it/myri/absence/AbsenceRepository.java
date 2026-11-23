package it.myri.absence;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AbsenceRepository extends JpaRepository<Absence, Long> {
    @Query("""
        select a from Absence a where a.personId = :personId and a.archivedAt is null
        and a.startsAt < :end and a.endsAt > :start
        """)
    List<Absence> overlapping(@Param("personId") Long personId,
            @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("""
        select a, p.firstName, p.lastName from Absence a, Person p
        where p.id = a.personId and a.archivedAt is null
        and a.startsAt < :end and a.endsAt > :start
        order by a.startsAt, a.id
        """)
    List<Object[]> month(@Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end, Pageable pageable);

    @Query("""
        select a, p.firstName, p.lastName from Absence a, Person p
        where p.id = a.personId and a.archivedAt is null and a.personId in :people
        and a.startsAt < :end and a.endsAt > :start
        order by a.startsAt, a.id
        """)
    List<Object[]> monthForPeople(@Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end, @Param("people") List<Long> people, Pageable pageable);
}
