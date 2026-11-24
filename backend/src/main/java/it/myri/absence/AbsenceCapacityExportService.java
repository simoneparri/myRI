package it.myri.absence;

import it.myri.common.ApiException;
import it.myri.person.Person;
import it.myri.person.PersonRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AbsenceCapacityExportService {
    private static final int MAX_PEOPLE = 5000;
    private static final int MAX_ABSENCES = 50000;
    private static final long WEEK_SECONDS = 40 * 60 * 60;
    private final AbsenceRepository absences;
    private final PersonRepository people;
    private final Clock clock;
    private final ZoneId zone;

    public AbsenceCapacityExportService(AbsenceRepository absences, PersonRepository people,
            Clock clock, ZoneId zone) {
        this.absences = absences;
        this.people = people;
        this.clock = clock;
        this.zone = zone;
    }

    @Transactional(readOnly = true)
    public byte[] export() throws IOException {
        LocalDate today = LocalDate.now(clock.withZone(zone));
        LocalDate currentMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate firstMonday = currentMonday.minusWeeks(1);
        int lastYear = today.get(WeekFields.ISO.weekBasedYear())
                + (today.get(WeekFields.ISO.weekOfWeekBasedYear()) > 23 ? 1 : 0);
        LocalDate lastMonday = LocalDate.of(lastYear, 12, 31)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate end = lastMonday.plusWeeks(1);
        List<Person> persons = people.capacityPeople(PageRequest.of(0, MAX_PEOPLE + 1));
        if (persons.size() > MAX_PEOPLE) {
            throw ApiException.invalid("Troppe persone per l'export capacity (massimo 5000).");
        }
        List<Object[]> rows = absences.month(firstMonday.atStartOfDay(), end.atStartOfDay(),
                PageRequest.of(0, MAX_ABSENCES + 1));
        if (rows.size() > MAX_ABSENCES) {
            throw ApiException.invalid("Troppe assenze per l'export capacity (massimo 50000).");
        }
        Map<Long, Map<LocalDate, Long>> totals = new HashMap<>();
        for (Object[] row : rows) {
            Absence absence = (Absence) row[0];
            LocalDate start = absence.startsAt.toLocalDate().isBefore(firstMonday)
                    ? firstMonday : absence.startsAt.toLocalDate();
            LocalDate stop = absence.endsAt.toLocalDate().isBefore(end)
                    ? absence.endsAt.toLocalDate() : end.minusDays(1);
            for (LocalDate day = start; !day.isAfter(stop); day = day.plusDays(1)) {
                if (day.getDayOfWeek().getValue() > 5) continue;
                long seconds = overlap(absence, day, 9, 13) + overlap(absence, day, 14, 18);
                if (seconds > 0) {
                    LocalDate monday = day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                    totals.computeIfAbsent(absence.personId, ignored -> new HashMap<>())
                            .merge(monday, seconds, Long::sum);
                }
            }
        }
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Assenze capacity");
            sheet.createFreezePane(1, 3);
            sheet.setColumnWidth(0, 30 * 256);
            var nameHeader = sheet.createRow(0);
            var fromHeader = sheet.createRow(1);
            var toHeader = sheet.createRow(2);
            CellStyle header = style(workbook, IndexedColors.GREY_25_PERCENT, false);
            CellStyle currentHeader = style(workbook, IndexedColors.LIGHT_GREEN, false);
            CellStyle dateHeader = dateStyle(workbook, header);
            CellStyle currentDateHeader = dateStyle(workbook, currentHeader);
            CellStyle percent = style(workbook, IndexedColors.WHITE, true);
            CellStyle currentPercent = style(workbook, IndexedColors.LIGHT_GREEN, true);
            nameHeader.createCell(0).setCellValue("Cognome, Nome");
            nameHeader.getCell(0).setCellStyle(header);
            int columns = 0;
            for (LocalDate monday = firstMonday; !monday.isAfter(lastMonday); monday = monday.plusWeeks(1)) {
                int column = ++columns;
                sheet.setColumnWidth(column, 13 * 256);
                CellStyle cellStyle = monday.equals(currentMonday) ? currentHeader : header;
                var heading = nameHeader.createCell(column);
                heading.setCellValue("WEEK " + monday.get(WeekFields.ISO.weekOfWeekBasedYear())
                        + "\n" + monday.get(WeekFields.ISO.weekBasedYear()));
                heading.setCellStyle(cellStyle);
                var from = fromHeader.createCell(column);
                from.setCellValue(monday);
                from.setCellStyle(monday.equals(currentMonday) ? currentDateHeader : dateHeader);
                var to = toHeader.createCell(column);
                to.setCellValue(monday.plusDays(4));
                to.setCellStyle(monday.equals(currentMonday) ? currentDateHeader : dateHeader);
            }
            nameHeader.setHeightInPoints(30);
            for (int i = 0; i < persons.size(); i++) {
                Person person = persons.get(i);
                var row = sheet.createRow(i + 3);
                row.createCell(0).setCellValue(person.lastName + ", " + person.firstName);
                Map<LocalDate, Long> personTotals = totals.getOrDefault(person.id, Map.of());
                LocalDate monday = firstMonday;
                for (int column = 1; column <= columns; column++, monday = monday.plusWeeks(1)) {
                    long seconds = Math.min(WEEK_SECONDS, personTotals.getOrDefault(monday, 0L));
                    long roundedPercent = (seconds * 100 + WEEK_SECONDS - 1) / WEEK_SECONDS;
                    var cell = row.createCell(column);
                    cell.setCellValue(roundedPercent / 100.0);
                    cell.setCellStyle(monday.equals(currentMonday) ? currentPercent : percent);
                }
            }
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private static long overlap(Absence absence, LocalDate day, int from, int to) {
        LocalDateTime start = day.atTime(LocalTime.of(from, 0));
        LocalDateTime end = day.atTime(LocalTime.of(to, 0));
        if (absence.startsAt.isAfter(start)) start = absence.startsAt;
        if (absence.endsAt.isBefore(end)) end = absence.endsAt;
        return start.isBefore(end) ? Duration.between(start, end).getSeconds() : 0;
    }

    private static CellStyle style(XSSFWorkbook workbook, IndexedColors color, boolean percent) {
        CellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(color.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setWrapText(true);
        if (percent) style.setDataFormat(workbook.createDataFormat().getFormat("0%"));
        return style;
    }

    private static CellStyle dateStyle(XSSFWorkbook workbook, CellStyle source) {
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(source);
        style.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy"));
        return style;
    }
}
