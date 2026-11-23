package it.myri.absence;

import it.myri.common.ApiException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.apache.poi.ooxml.POIXMLException;
import org.apache.poi.openxml4j.exceptions.OLE2NotOfficeXmlFileException;
import org.apache.poi.openxml4j.exceptions.OpenXML4JRuntimeException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

final class AbsenceXlsxReader {
    private static final String SHEET = "Absences for COE";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    private static final int MAX_EXPANDED_BYTES = 32 * 1024 * 1024;
    private static final int MAX_ENTRIES = 2000;
    private static final int MAX_PHYSICAL_ROWS = 10000;

    private AbsenceXlsxReader() {}

    static List<AbsenceService.ImportRow> read(byte[] bytes) {
        checkArchive(bytes);
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = workbook.getSheet(SHEET);
            if (sheet == null) throw ApiException.invalid("Foglio XLSX 'Absences for COE' mancante.");
            DataFormatter formatter = new DataFormatter(Locale.ITALY);
            Row header = sheet.getRow(0);
            if (header == null || !"ResID".equals(value(header.getCell(0), formatter))) {
                throw ApiException.invalid("Intestazione XLSX Agresso non valida.");
            }
            Map<String, Integer> columns = new HashMap<>();
            for (Cell cell : header) {
                String name = value(cell, formatter);
                if (!name.isEmpty() && columns.putIfAbsent(name, cell.getColumnIndex()) != null) {
                    throw ApiException.invalid("Intestazione XLSX Agresso duplicata.");
                }
            }
            if (!columns.keySet().containsAll(AbsenceService.HEADERS)) {
                throw ApiException.invalid("Intestazione XLSX Agresso non valida.");
            }
            List<AbsenceService.ImportRow> rows = new ArrayList<>();
            int physicalRows = 0;
            for (Row row : sheet) {
                if (++physicalRows > MAX_PHYSICAL_ROWS) {
                    throw ApiException.invalid("Il foglio XLSX contiene troppe righe.");
                }
                if (row.getRowNum() == 0) continue;
                Cell first = row.getCell(0);
                if (first == null || first.getCellType() == CellType.BLANK
                        || (first.getCellType() == CellType.STRING && first.getStringCellValue().trim().isEmpty())) {
                    continue;
                }
                if (rows.size() == AbsenceService.MAX_ROWS) {
                    throw ApiException.invalid("Massimo 5000 righe per import.");
                }
                Map<String, String> fields = new HashMap<>();
                for (String name : AbsenceService.HEADERS) {
                    Cell cell = row.getCell(columns.get(name));
                    fields.put(name, fieldValue(cell, name, formatter));
                }
                rows.add(new AbsenceService.ImportRow(row.getRowNum() + 1L, fields));
            }
            return rows;
        } catch (IOException | OpenXML4JRuntimeException | OLE2NotOfficeXmlFileException | POIXMLException exception) {
            throw ApiException.invalid("Formato XLSX non valido.");
        }
    }

    private static String fieldValue(Cell cell, String name, DataFormatter formatter) {
        if (cell == null || cell.getCellType() == CellType.FORMULA || cell.getCellType() == CellType.ERROR) {
            return "";
        }
        if ((name.equals("Date from") || name.equals("Date to"))
                && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            if (!DateUtil.isValidExcelDate(cell.getNumericCellValue())) return "";
            try {
                LocalDateTime date = cell.getLocalDateTimeCellValue();
                return date.toLocalTime().equals(LocalTime.MIDNIGHT) ? DATE.format(date) : "";
            } catch (DateTimeException exception) {
                return "";
            }
        }
        return value(cell, formatter);
    }

    private static String value(Cell cell, DataFormatter formatter) {
        if (cell == null || cell.getCellType() == CellType.FORMULA || cell.getCellType() == CellType.ERROR) return "";
        return formatter.formatCellValue(cell).trim();
    }

    private static void checkArchive(byte[] bytes) {
        int entries = 0;
        long expanded = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            byte[] buffer = new byte[8192];
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > MAX_ENTRIES) throw ApiException.invalid("Archivio XLSX troppo complesso.");
                int count;
                while ((count = zip.read(buffer)) != -1) {
                    expanded += count;
                    if (expanded > MAX_EXPANDED_BYTES) {
                        throw ApiException.invalid("Archivio XLSX troppo grande dopo la decompressione.");
                    }
                }
            }
            if (entries == 0) throw ApiException.invalid("Formato XLSX non valido.");
        } catch (IOException exception) {
            throw ApiException.invalid("Formato XLSX non valido.");
        }
    }
}
