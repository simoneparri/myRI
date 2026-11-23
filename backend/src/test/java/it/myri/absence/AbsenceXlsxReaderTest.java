package it.myri.absence;

import static org.junit.jupiter.api.Assertions.*;

import it.myri.common.ApiException;
import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class AbsenceXlsxReaderTest {
    @Test
    void selectsNamedSheetSkipsTotalsAndConvertsExcelDatesAndNumbers() throws Exception {
        var rows = AbsenceXlsxReader.read(AbsenceXlsxTestData.workbook("001"));
        assertEquals(2, rows.size());
        assertEquals(2, rows.get(0).number());
        assertEquals(5, rows.get(1).number());
        var fields = rows.get(0).fields();
        assertEquals("001", fields.get("ResID"));
        assertEquals("01/02/2026", fields.get("Date from"));
        assertEquals("900", fields.get("Time from"));
        assertEquals("1", fields.get("Days"));
        assertEquals("8,00", fields.get("Hours"));
        assertEquals("0", fields.get("Imported to Timesheet"));
    }

    @Test
    void rejectsMissingSheetInvalidHeadersAndInvalidArchive() throws Exception {
        assertThrows(ApiException.class, () -> AbsenceXlsxReader.read(new byte[] {1, 2}));
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("invalid.txt"));
            zip.write(1);
            zip.closeEntry();
            zip.finish();
            assertThrows(ApiException.class, () -> AbsenceXlsxReader.read(out.toByteArray()));
        }
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            workbook.createSheet("Other");
            workbook.write(out);
            assertThrows(ApiException.class, () -> AbsenceXlsxReader.read(out.toByteArray()));
        }
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            workbook.createSheet("Absences for COE").createRow(0).createCell(0).setCellValue("ResID");
            workbook.write(out);
            assertThrows(ApiException.class, () -> AbsenceXlsxReader.read(out.toByteArray()));
        }

    }

    @Test
    void formulaFieldsAreNotEvaluatedAndNumericIdentifiersKeepFormatting() throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(AbsenceXlsxTestData.workbook("001")));
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var row = workbook.getSheet("Absences for COE").getRow(1);
            row.getCell(0).setCellValue(1);
            var style = workbook.createCellStyle();
            style.setDataFormat(workbook.createDataFormat().getFormat("00000"));
            row.getCell(0).setCellStyle(style);
            row.getCell(4).setCellFormula("\"Ferie\"");
            workbook.write(out);
            var fields = AbsenceXlsxReader.read(out.toByteArray()).getFirst().fields();
            assertEquals("00001", fields.get("ResID"));
            assertEquals("", fields.get("Abs. code (T)"));
        }
    }

    @Test
    void rejectsTooManyRecordsAndExpandedArchives() throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(AbsenceXlsxTestData.workbook("001")));
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = workbook.getSheet("Absences for COE");
            for (int i = 5; i < 5005; i++) sheet.createRow(i).createCell(0).setCellValue("fittizio");
            workbook.write(out);
            assertThrows(ApiException.class, () -> AbsenceXlsxReader.read(out.toByteArray()));
        }
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("large.xml"));
            byte[] buffer = new byte[8192];
            for (int i = 0; i <= 4096; i++) zip.write(buffer);
            zip.closeEntry();
            zip.finish();
            assertThrows(ApiException.class, () -> AbsenceXlsxReader.read(out.toByteArray()));
        }
    }
}
