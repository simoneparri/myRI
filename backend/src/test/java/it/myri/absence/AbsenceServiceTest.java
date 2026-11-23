package it.myri.absence;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import it.myri.common.ApiException;
import it.myri.person.Person;
import it.myri.person.PersonRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AbsenceServiceTest {
    private static final String HEADER = "ResID;Abs. code;Abs. code (T);Date from;Time from;"
            + "Date to;Time to;Workflow status (T);Days;Hours;Imported to Timesheet\n";
    private final AbsenceRepository repository = mock(AbsenceRepository.class);
    private final PersonRepository people = mock(PersonRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
    private final AbsenceService service = new AbsenceService(repository, people, clock);

    @Test
    void skipsInvalidAndUnknownRowsWithoutDiscardingValidOnes() {
        Person person = new Person();
        person.id = 1L;
        when(people.findByRsnoAgresso("001")).thenReturn(Optional.of(person));
        when(people.findByRsnoAgresso("002")).thenReturn(Optional.empty());
        var report = service.importCsv("\ufeff" + HEADER
                + "001;F;\"Ferie; fittizie\";01/02/2026;900;01/02/2026;1700;Approvata;1;8;Si\n"
                + "002;F;Ferie;01/02/2026;900;01/02/2026;1700;Approvata;1;8;Si\n"
                + "001;F;Ferie;30/02/2026;900;01/02/2026;1700;Approvata;1;8;Si\n"
                + "001;F;Ferie;01/02/0001;900;01/02/0001;1700;Approvata;1;8;Si\n");
        assertEquals(1, report.imported());
        assertEquals(3, report.skipped());
        assertEquals(List.of(3L, 4L, 5L), report.errors().stream().map(AbsenceDtos.RowError::row).toList());
        var saved = org.mockito.ArgumentCaptor.forClass(Absence.class);
        verify(repository).save(saved.capture());
        assertEquals("Ferie; fittizie", saved.getValue().absenceLabel);
        assertEquals(LocalDateTime.of(2026, 2, 1, 9, 0), saved.getValue().startsAt);
    }

    @Test
    void identicalIsUnchangedAndOverlappingDifferentRowsAreArchived() {
        Person person = new Person();
        person.id = 1L;
        when(people.findByRsnoAgresso("001")).thenReturn(Optional.of(person));
        Absence old = new Absence();
        old.startsAt = LocalDateTime.of(2026, 2, 1, 9, 0);
        old.endsAt = LocalDateTime.of(2026, 2, 1, 17, 0);
        old.absenceCode = "F";
        old.absenceLabel = "Ferie";
        old.workflowStatus = "Approvata";
        old.days = "1";
        old.hours = "8";
        old.importedToTimesheet = "Si";
        when(repository.overlapping(eq(1L), any(), any())).thenReturn(List.of(old));
        String row = "001;F;Ferie;01/02/2026;900;01/02/2026;1700;Approvata;1;8;Si\n";
        assertEquals(1, service.importCsv(HEADER + row).unchanged());
        assertNull(old.archivedAt);
        var report = service.importCsv(HEADER + row.replace("1700", "1800"));
        assertEquals(1, report.replaced());
        assertEquals(clock.instant(), old.archivedAt);
        verify(repository, times(1)).save(any());
    }

    @Test
    void rejectsMalformedFileAndInvalidFilter() {
        assertThrows(ApiException.class, () -> service.importCsv("wrong;header\n"));
        assertThrows(ApiException.class, () -> service.importCsv(HEADER + "001;\"unterminated"));
        assertThrows(ApiException.class, () -> service.month(java.time.YearMonth.of(2026, 1), List.of(-1L)));
        verifyNoInteractions(people);
    }
}
