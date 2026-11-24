package it.myri.absence;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import it.myri.common.ApiException;
import it.myri.person.Person;
import it.myri.person.PersonRepository;
import java.io.ByteArrayInputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class AbsenceCapacityExportServiceTest {
    private final AbsenceRepository absences = mock(AbsenceRepository.class);
    private final PersonRepository people = mock(PersonRepository.class);
    private final ZoneId zone = ZoneId.of("Europe/Rome");

    private AbsenceCapacityExportService service(String instant) {
        return new AbsenceCapacityExportService(absences, people,
                Clock.fixed(Instant.parse(instant), ZoneOffset.UTC), zone);
    }

    private static Person person(long id, String lastName) {
        Person person = new Person();
        person.id = id;
        person.firstName = "Fittizia";
        person.lastName = lastName;
        return person;
    }

    private static Object[] absence(long personId, String start, String end) {
        Absence absence = new Absence();
        absence.personId = personId;
        absence.startsAt = LocalDateTime.parse(start);
        absence.endsAt = LocalDateTime.parse(end);
        return new Object[] {absence, "Fittizia", "Persona"};
    }

    @Test
    void exportsAllPeopleAndCalculatesWorkIntervalsAcrossWeeks() throws Exception {
        when(people.capacityPeople(any())).thenReturn(List.of(person(1, "=Formula"), person(2, "Senza")));
        List<Object[]> rows = new ArrayList<>();
        rows.add(absence(1, "2026-06-08T09:00:00", "2026-06-12T18:00:00"));
        rows.add(absence(1, "2026-06-15T12:30:00", "2026-06-15T14:30:00"));
        rows.add(absence(1, "2026-06-19T17:30:00", "2026-06-22T09:30:00"));
        rows.add(absence(1, "2026-06-20T09:00:00", "2026-06-21T18:00:00"));
        when(absences.month(any(), any(), any())).thenReturn(rows);
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(
                service("2026-06-15T10:00:00Z").export()))) {
            var sheet = workbook.getSheetAt(0);
            assertEquals("Cognome, Nome", sheet.getRow(0).getCell(0).getStringCellValue());
            assertEquals("WEEK 24\n2026", sheet.getRow(0).getCell(1).getStringCellValue());
            assertEquals("WEEK 25\n2026", sheet.getRow(0).getCell(2).getStringCellValue());
            assertEquals(IndexedColors.LIGHT_GREEN.getIndex(),
                    sheet.getRow(0).getCell(2).getCellStyle().getFillForegroundColor());
            assertEquals(CellType.STRING, sheet.getRow(3).getCell(0).getCellType());
            assertEquals("=Formula, Fittizia", sheet.getRow(3).getCell(0).getStringCellValue());
            assertEquals(1.0, sheet.getRow(3).getCell(1).getNumericCellValue(), 0.00001);
            assertEquals(0.04, sheet.getRow(3).getCell(2).getNumericCellValue(), 0.00001);
            assertEquals(0.02, sheet.getRow(3).getCell(3).getNumericCellValue(), 0.00001);
            assertEquals(0, sheet.getRow(4).getCell(2).getNumericCellValue());
            assertEquals(LocalDate.of(2027, 12, 27), sheet.getRow(1)
                    .getCell(sheet.getRow(0).getLastCellNum() - 1).getLocalDateTimeCellValue().toLocalDate());
        }
    }

    @Test
    void week23StopsAtCurrentYearAndWeek24ExtendsToFollowingYear() throws Exception {
        when(people.capacityPeople(any())).thenReturn(List.of());
        when(absences.month(any(), any(), any())).thenReturn(List.of());
        try (XSSFWorkbook week23 = new XSSFWorkbook(new ByteArrayInputStream(
                service("2026-06-03T10:00:00Z").export()));
             XSSFWorkbook week24 = new XSSFWorkbook(new ByteArrayInputStream(
                service("2026-06-10T10:00:00Z").export()))) {
            var first = week23.getSheetAt(0);
            var second = week24.getSheetAt(0);
            assertEquals(LocalDate.of(2026, 12, 28), first.getRow(1)
                    .getCell(first.getRow(0).getLastCellNum() - 1).getLocalDateTimeCellValue().toLocalDate());
            assertEquals(LocalDate.of(2027, 12, 27), second.getRow(1)
                    .getCell(second.getRow(0).getLastCellNum() - 1).getLocalDateTimeCellValue().toLocalDate());
        }
    }

    @Test
    void usesIsoWeekYearAcrossNewYearAndApplicationTimezone() throws Exception {
        when(people.capacityPeople(any())).thenReturn(List.of());
        when(absences.month(any(), any(), any())).thenReturn(List.of());
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(
                service("2026-12-31T23:30:00Z").export()))) {
            var sheet = workbook.getSheetAt(0);
            assertEquals("WEEK 53\n2026", sheet.getRow(0).getCell(2).getStringCellValue());
            assertEquals(LocalDate.of(2027, 12, 27), sheet.getRow(1)
                    .getCell(sheet.getRow(0).getLastCellNum() - 1).getLocalDateTimeCellValue().toLocalDate());
        }
    }

    @Test
    void rejectsExcessiveDataInsteadOfTruncating() {
        when(people.capacityPeople(any())).thenReturn(java.util.Collections.nCopies(5001, person(1, "Fittizia")));
        assertThrows(ApiException.class, () -> service("2026-06-10T10:00:00Z").export());
        verifyNoInteractions(absences);
        when(people.capacityPeople(any())).thenReturn(List.of());
        when(absences.month(any(), any(), any())).thenReturn(java.util.Collections.nCopies(50001, new Object[0]));
        assertThrows(ApiException.class, () -> service("2026-06-10T10:00:00Z").export());
    }
}
