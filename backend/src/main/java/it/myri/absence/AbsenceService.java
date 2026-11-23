package it.myri.absence;

import it.myri.common.ApiException;
import it.myri.person.Person;
import it.myri.person.PersonRepository;
import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AbsenceService {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/uuuu")
            .withResolverStyle(ResolverStyle.STRICT);
    static final Set<String> HEADERS = Set.of("ResID", "Abs. code", "Abs. code (T)",
            "Date from", "Time from", "Date to", "Time to", "Workflow status (T)",
            "Days", "Hours", "Imported to Timesheet");
    static final int MAX_ROWS = 5000;
    private final AbsenceRepository absences;
    private final PersonRepository people;
    private final Clock clock;

    public AbsenceService(AbsenceRepository absences, PersonRepository people, Clock clock) {
        this.absences = absences;
        this.people = people;
        this.clock = clock;
    }

    @Transactional
    public AbsenceDtos.ImportReport importCsv(String csv) {
        List<ImportRow> rows = new ArrayList<>();
        try (CSVParser parser = CSVFormat.DEFAULT.builder().setDelimiter(';').setHeader()
                .setSkipHeaderRecord(true).setDuplicateHeaderMode(
                        org.apache.commons.csv.DuplicateHeaderMode.DISALLOW).get()
                .parse(new StringReader(csv.startsWith("\ufeff") ? csv.substring(1) : csv))) {
            if (!parser.getHeaderMap().keySet().containsAll(HEADERS)) {
                throw ApiException.invalid("Intestazione CSV Agresso non valida.");
            }
            for (CSVRecord row : parser) {
                if (rows.size() == MAX_ROWS) throw ApiException.invalid("Massimo 5000 righe per import.");
                Map<String, String> fields = new HashMap<>();
                if (row.isConsistent()) {
                    for (String header : HEADERS) fields.put(header, row.get(header));
                }
                rows.add(new ImportRow(row.getRecordNumber() + 1, fields));
            }
        } catch (IOException | UncheckedIOException | IllegalArgumentException exception) {
            throw ApiException.invalid("Formato CSV non valido.");
        }

        return importRows(rows);
    }

    @Transactional
    public AbsenceDtos.ImportReport importXlsx(byte[] xlsx) {
        return importRows(AbsenceXlsxReader.read(xlsx));
    }

    private AbsenceDtos.ImportReport importRows(List<ImportRow> rows) {
        int imported = 0, unchanged = 0, skipped = 0, replaced = 0;
        List<AbsenceDtos.RowError> errors = new ArrayList<>();
        for (ImportRow row : rows) {
            Parsed parsed;
            try {
                parsed = parse(row.fields());
            } catch (IllegalArgumentException exception) {
                skipped++;
                errors.add(new AbsenceDtos.RowError(row.number(), "Dati non validi."));
                continue;
            }
            Person person = people.findByRsnoAgresso(parsed.resId()).orElse(null);
            if (person == null) {
                skipped++;
                errors.add(new AbsenceDtos.RowError(row.number(),
                        "Nessuna persona con questo RSNO Agresso."));
                continue;
            }
            List<Absence> overlaps = absences.overlapping(person.id, parsed.start(), parsed.end());
            if (overlaps.size() == 1 && same(overlaps.getFirst(), parsed)) {
                unchanged++;
                continue;
            }
            for (Absence old : overlaps) {
                old.archivedAt = clock.instant();
                old.touch(clock);
                replaced++;
            }
            Absence absence = new Absence();
            absence.personId = person.id;
            absence.startsAt = parsed.start();
            absence.endsAt = parsed.end();
            absence.absenceCode = parsed.code();
            absence.absenceLabel = parsed.label();
            absence.workflowStatus = parsed.status();
            absence.days = parsed.days();
            absence.hours = parsed.hours();
            absence.importedToTimesheet = parsed.importedToTimesheet();
            absence.initialize(clock);
            absences.save(absence);
            imported++;
        }
        return new AbsenceDtos.ImportReport(imported, unchanged, skipped, replaced, List.copyOf(errors));
    }

    @Transactional(readOnly = true)
    public List<AbsenceDtos.View> month(YearMonth month, List<Long> personIds) {
        if (personIds.size() > 100 || personIds.stream().anyMatch(id -> id == null || id <= 0)) {
            throw ApiException.invalid("Selezionare al massimo 100 persone valide.");
        }
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();
        List<Object[]> result = personIds.isEmpty()
                ? absences.month(start, end, PageRequest.of(0, MAX_ROWS + 1))
                : absences.monthForPeople(start, end, personIds, PageRequest.of(0, MAX_ROWS + 1));
        if (result.size() > MAX_ROWS) {
            throw ApiException.invalid("Troppe assenze nel mese: filtrare per persona.");
        }
        return result.stream().map(row -> {
            Absence a = (Absence) row[0];
            return new AbsenceDtos.View(a.id.toString(), a.personId.toString(), (String) row[1],
                    (String) row[2], a.startsAt, a.endsAt, a.absenceCode, a.absenceLabel,
                    a.workflowStatus, a.days, a.hours, a.importedToTimesheet);
        }).toList();
    }

    private static boolean same(Absence a, Parsed p) {
        return a.startsAt.equals(p.start()) && a.endsAt.equals(p.end())
                && a.absenceCode.equals(p.code()) && a.absenceLabel.equals(p.label())
                && a.workflowStatus.equals(p.status()) && a.days.equals(p.days())
                && a.hours.equals(p.hours()) && a.importedToTimesheet.equals(p.importedToTimesheet());
    }

    private static Parsed parse(Map<String, String> row) {
        String resId = field(row, "ResID", 100);
        String code = field(row, "Abs. code", 100);
        String label = field(row, "Abs. code (T)", 255);
        String status = field(row, "Workflow status (T)", 100);
        String days = field(row, "Days", 50);
        String hours = field(row, "Hours", 50);
        String importedToTimesheet = field(row, "Imported to Timesheet", 100);
        try {
            LocalDateTime start = LocalDateTime.of(LocalDate.parse(field(row, "Date from", 10), DATE),
                    time(field(row, "Time from", 4)));
            LocalDateTime end = LocalDateTime.of(LocalDate.parse(field(row, "Date to", 10), DATE),
                    time(field(row, "Time to", 4)));
            if (start.getYear() < 1000 || end.getYear() < 1000 || !start.isBefore(end)) {
                throw new IllegalArgumentException();
            }
            return new Parsed(resId, start, end, code, label, status, days, hours, importedToTimesheet);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException();
        }
    }

    private static String field(Map<String, String> row, String key, int max) {
        String raw = row.get(key);
        if (raw == null) throw new IllegalArgumentException();
        String value = raw.trim();
        if (value.isEmpty() || value.length() > max) throw new IllegalArgumentException();
        return value;
    }

    private static LocalTime time(String value) {
        String text = value.trim();
        if (!text.matches("[0-9]{3,4}")) throw new IllegalArgumentException();
        int n = Integer.parseInt(text);
        if (n / 100 > 23 || n % 100 > 59) throw new IllegalArgumentException();
        return LocalTime.of(n / 100, n % 100);
    }

    private record Parsed(String resId, LocalDateTime start, LocalDateTime end,
            String code, String label, String status, String days, String hours, String importedToTimesheet) {}
    record ImportRow(long number, Map<String, String> fields) {}
}
