package it.myri.absence;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import it.myri.IntegrationTest;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

class AbsenceIntegrationTest extends IntegrationTest {
    @Autowired AbsenceService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;

    @Test
    void migrationImportOverlapAndMonthFilteringWorkWithMysql() throws Exception {
        jdbc.update("INSERT INTO person (first_name,last_name,hired_on,rsno_agresso,status,created_at,updated_at,version) "
                + "VALUES ('Persona','Fittizia','2020-01-01','abs-test-001','active',NOW(),NOW(),0)");
        Long id = jdbc.queryForObject("SELECT id FROM person WHERE rsno_agresso = 'abs-test-001'", Long.class);
        String header = "ResID;Abs. code;Abs. code (T);Date from;Time from;Date to;Time to;"
                + "Workflow status (T);Days;Hours;Imported to Timesheet\n";
        String first = "abs-test-001;F;Ferie;01/02/2026;900;01/02/2026;1700;Approvata;1;8;Si\n";
        String adjacent = "abs-test-001;F;Ferie;01/02/2026;1700;01/02/2026;1800;Approvata;0,125;1;No\n";
        assertEquals(2, service.importCsv(header + first + adjacent).imported());
        assertEquals(2, service.importCsv(header + first + adjacent).unchanged());
        assertEquals(2, service.month(YearMonth.of(2026, 2), List.of(id)).size());
        mvc.perform(get("/api/v1/absences").with(user("fittizio").roles("OWNER"))
                .param("month", "2026-02").param("personIds", id + ",999999"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].personId").value(id.toString()))
                .andExpect(jsonPath("$[0].days").value("1"))
                .andExpect(jsonPath("$[1].days").value("0,125"))
                .andExpect(jsonPath("$[1].importedToTimesheet").value("No"));
        assertTrue(service.month(YearMonth.of(2026, 3), List.of()).isEmpty());
        String overlap = "abs-test-001;P;Permesso;01/02/2026;1600;01/02/2026;1730;Inviata;0,2;1,5;No\n";
        var replacement = service.importCsv(header + overlap);
        assertEquals(2, replacement.replaced());
        assertEquals(1, replacement.imported());
        assertEquals(1, service.month(YearMonth.of(2026, 2), List.of(id)).size());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM absence WHERE archived_at IS NOT NULL", Integer.class));
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> jdbc.update("DELETE FROM absence"));
    }

    @Test
    void apiRequiresLoginAndCsrfAndReturnsRowErrors() throws Exception {
        String csv = "ResID;Abs. code;Abs. code (T);Date from;Time from;Date to;Time to;"
                + "Workflow status (T);Days;Hours;Imported to Timesheet\n"
                + "unknown;F;Ferie;01/02/2026;900;01/02/2026;1700;Approvata;1;8;No\n";
        mvc.perform(get("/api/v1/absences").param("month", "2026-02"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/absences/import").with(user("fittizio").roles("OWNER"))
                .contentType("text/csv").content(csv)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/absences/import").with(user("fittizio").roles("OWNER")).with(csrf())
                .contentType("text/csv").content(csv))
                .andExpect(status().isOk()).andExpect(jsonPath("$.skipped").value(1))
                .andExpect(jsonPath("$.errors[0].row").value(2));
        mvc.perform(post("/api/v1/absences/import").with(user("fittizio").roles("OWNER")).with(csrf())
                .contentType("text/csv").content(new byte[] {(byte) 0xff}))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/absences").with(user("fittizio").roles("OWNER"))
                .param("month", "2026-02").param("personIds", "-1"))
                .andExpect(status().isBadRequest());
    }
}
