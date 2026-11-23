package it.myri.absence;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

final class AbsenceXlsxTestData {
    static final String MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final String[] HEADERS = {"ResID", "ResID (T)", "Resource Manager", "Abs. code",
            "Abs. code (T)", "Date from", "Time from", "Date to", "Time to", "Days", "Hours",
            "Workflow status (T)", "Imported to Timesheet"};

    static byte[] workbook(String personId) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            workbook.createSheet("Parameters").createRow(0).createCell(0).setCellValue("non importare");
            var sheet = workbook.createSheet("Absences for COE");
            Row header = sheet.createRow(0);
            for (int i = 0; i < HEADERS.length; i++) header.createCell(i).setCellValue(HEADERS[i]);
            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue(personId);
            row.createCell(1).setCellValue("Nome fittizio");
            row.createCell(3).setCellValue("F");
            row.createCell(4).setCellValue("Ferie");
            CellStyle date = workbook.createCellStyle();
            date.setDataFormat(workbook.createDataFormat().getFormat("mm-dd-yy"));
            row.createCell(5).setCellValue(LocalDate.of(2026, 2, 1));
            row.getCell(5).setCellStyle(date);
            row.createCell(6).setCellValue(900);
            row.createCell(7).setCellValue(LocalDate.of(2026, 2, 1));
            row.getCell(7).setCellStyle(date);
            row.createCell(8).setCellValue(1700);
            row.createCell(9).setCellValue(1);
            row.createCell(10).setCellValue(8);
            CellStyle decimal = workbook.createCellStyle();
            decimal.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00;[Red]-#,##0.00"));
            row.getCell(10).setCellStyle(decimal);
            row.createCell(11).setCellValue("Approvata");
            row.createCell(12).setCellValue(0);
            Row total = sheet.createRow(2);
            total.createCell(9).setCellFormula("SUM(J2:J2)");
            Row invalid = sheet.createRow(4);
            invalid.createCell(0).setCellValue("sconosciuto");
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private AbsenceXlsxTestData() {}
}
