package it.myri;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import com.fasterxml.jackson.databind.ObjectMapper;
import it.myri.reminder.ReminderService;
import it.myri.export.PersonExportService;
import java.sql.Statement;
import java.time.*;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.security.test.context.support.WithAnonymousUser;

@Import(Step4ApiTest.Time.class)
@Transactional
@WithMockUser(roles = "OWNER")
class Step4ApiTest extends IntegrationTest {
    @TestConfiguration
    static class Time {
        @Bean @Primary Clock fixedClock() { return Clock.fixed(Instant.parse("2026-11-03T11:00:00Z"), ZoneOffset.UTC); }
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ReminderService reminders;
    @Autowired PlatformTransactionManager transactions;

    long insert(String sql, Object... args) {
        var key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
            return statement;
        }, key);
        return key.getKey().longValue();
    }
    long person(String hired) {
        return insert("INSERT INTO person(first_name,last_name,hired_on,status,version) VALUES('Fittizia','Test',?,'active',0)", hired);
    }
    long task(long personId, String due, String state) {
        return insert("INSERT INTO task(title,person_id,due_at,priority,status,version) VALUES('Task fittizio',?,?,'medium',?,0)", personId, due, state);
    }
    @Test
    void remindersDeduplicateArchivedKeysRespectTaskStateAndNewDueDateCycles() {
        long person = person("2026-10-01");
        long task = task(person, "2026-11-03 22:59:59", "todo");
        long future = task(person, "2026-11-03 23:00:00", "todo");
        long cancelled = task(person, "2026-11-01 10:00:00", "cancelled");
        reminders.generate();
        assertEquals(1, count(task));
        assertEquals(0, count(future));
        assertEquals(0, count(cancelled));
        jdbc.update("UPDATE notification SET archived_at=UTC_TIMESTAMP(6) WHERE task_id=?", task);
        reminders.generate();
        assertEquals(1, count(task));
        jdbc.update("UPDATE task SET due_at='2026-11-02 10:00:00' WHERE id=?", task);
        reminders.generate();
        assertEquals(2, count(task));
    }
    int count(long task) { return jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE task_id=?", Integer.class, task); }

    @Test
    void careerRemindersIgnoreFutureTalksAndRequireStrictThresholdAndActivePeople() {
        long stale = person("2026-08-02");
        long boundary = person("2026-08-03");
        long inactive = person("2020-01-01");
        jdbc.update("UPDATE person SET status='inactive' WHERE id=?", inactive);
        insert("INSERT INTO career_talk(person_id,held_at,version) VALUES(?,'2026-12-01 10:00:00',0)", stale);
        reminders.generate();
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE person_id=?", Integer.class, stale));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE person_id=?", Integer.class, boundary));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE person_id=?", Integer.class, inactive));
        long talk = insert("INSERT INTO career_talk(person_id,held_at,version) VALUES(?,'2026-07-01 10:00:00',0)", stale);
        reminders.generate();
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE deduplication_key=?", Integer.class, "career:" + stale + ":" + talk));
        reminders.generate();
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE person_id=?", Integer.class, stale));
    }
    @Test
    void todoViewsUseCalendarBoundariesAndExcludeClosedArchivedAndUndatedTasks() throws Exception {
        long p = person("2026-10-01");
        task(p, "2026-11-02 23:00:00", "todo");
        task(p, "2026-11-03 10:00:00", "in_progress");
        task(p, "2026-11-03 23:00:00", "todo");
        task(p, "2026-11-10 23:00:00", "todo");
        task(p, null, "todo");
        long archived = task(p, "2026-11-03 10:00:00", "todo");
        jdbc.update("UPDATE task SET archived_at=UTC_TIMESTAMP(6) WHERE id=?", archived);
        for (String view : new String[] {"today", "overdue"}) {
            mvc.perform(get("/api/v1/todos").param("personId", "" + p).param("view", view))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        }
        mvc.perform(get("/api/v1/todos").param("personId", "" + p).param("view", "next7"))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/todos").param("view", "invalid")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/todos").param("personId", "-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/dashboard")).andExpect(status().isOk()).andExpect(jsonPath("$.timezone").value("Europe/Rome"));
        mvc.perform(get("/api/v1/dashboard/career-due").param("size", "101")).andExpect(status().isBadRequest());
    }
    @Test
    void exportsIncludeArchivesPreserveDecimalsAndDoNotIncludeOtherPeopleOrSecrets() throws Exception {
        long p = person("2026-01-01"), other = person("2026-01-01");
        jdbc.update("UPDATE person SET notes=?, archived_at=UTC_TIMESTAMP(6) WHERE id=?", "=SUM(1,2)\n\"fittizia\"", p);
        insert("INSERT INTO contact(person_id,type,value,version) VALUES(?,'chat','other-person',0)", other);
        insert("INSERT INTO contact(person_id,type,value,archived_at,version) VALUES(?,'email','test@example.test',UTC_TIMESTAMP(6),0)", p);
        insert("INSERT INTO salary(person_id,amount,currency,effective_on,reason) VALUES(?,9999999999.99,'EUR','2026-01-01','Fittizia')", p);
        var response = mvc.perform(get("/api/v1/people/" + p + "/export")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"person-export.json\""))
                .andReturn().getResponse().getContentAsString();
        var snapshot = json.readTree(response);
        assertEquals(1, snapshot.get("schemaVersion").intValue());
        assertEquals("" + p, snapshot.get("person").get("id").asText());
        assertTrue(snapshot.get("person").get("id").isTextual());
        assertEquals("9999999999.99", snapshot.get("salaries").get(0).get("amount").asText());
        assertEquals(1, snapshot.get("contacts").size());
        assertFalse(response.contains("password"));
        assertFalse(response.contains("other-person"));
        var csv = mvc.perform(get("/api/v1/people/" + p + "/export").param("format", "csv"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("\"'=SUM(1,2)\n\"\"fittizia\"\"\""));
        assertTrue(csv.startsWith("recordType,schemaVersion,exportedAt"));
        mvc.perform(get("/api/v1/people/" + p + "/salary-trend")).andExpect(jsonPath("$.items[0].amount").value("9999999999.99"));
        mvc.perform(get("/api/v1/people/" + p + "/export").param("format", "xml")).andExpect(status().isBadRequest());
    }
    @Test
    void csvNeutralizesWhitespacePrefixedFormulasAndQuotesNewlines() {
        assertEquals("\"'  =1+1\"", PersonExportService.cell("  =1+1"));
        assertEquals("\"'@cmd\"", PersonExportService.cell("@cmd"));
        assertEquals("\"'\\ttext\"".replace("\\t", "\t"), PersonExportService.cell("\ttext"));
        assertEquals("\"safe,\"\"text\"\"\n\"", PersonExportService.cell("safe,\"text\"\n"));
    }
    @Test
    @WithAnonymousUser
    void step4EndpointsRequireLogin() throws Exception {
        for (String path : new String[] {"dashboard", "dashboard/career-due", "todos", "notifications",
                "people/1/export", "people/1/salary-trend"}) {
            mvc.perform(get("/api/v1/" + path)).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void exportRejectsOversizeSnapshotsWithoutTruncation() throws Exception {
        long p = person("2026-01-01");
        for (int i = 0; i < 999; i++) {
            insert("INSERT INTO contact(person_id,type,value,version) VALUES(?,'chat','Fittizio',0)", p);
        }
        mvc.perform(get("/api/v1/people/" + p + "/export")).andExpect(status().isOk())
                .andExpect(jsonPath("$.contacts.length()").value(999));
        insert("INSERT INTO contact(person_id,type,value,version) VALUES(?,'chat','Fittizio',0)", p);
        mvc.perform(get("/api/v1/people/" + p + "/export"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("nessun dato e stato troncato")));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void competingSchedulersGenerateOnlyOneNotificationPerCycle() throws Exception {
        var tx = new TransactionTemplate(transactions);
        long[] ids = tx.execute(status -> {
            long p = person("2026-01-01");
            return new long[] {p, task(p, "2026-11-02 10:00:00", "todo")};
        });
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> { start.await(); reminders.generate(); return true; });
            var second = pool.submit(() -> { start.await(); reminders.generate(); return true; });
            start.countDown();
            assertTrue(first.get(30, java.util.concurrent.TimeUnit.SECONDS));
            assertTrue(second.get(30, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1, count(ids[1]));
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE person_id=?", Integer.class, ids[0]));
        } finally {
            tx.executeWithoutResult(status -> {
                jdbc.update("UPDATE task SET archived_at=UTC_TIMESTAMP(6) WHERE id=?", ids[1]);
                jdbc.update("UPDATE person SET archived_at=UTC_TIMESTAMP(6) WHERE id=?", ids[0]);
                jdbc.update("UPDATE notification SET archived_at=UTC_TIMESTAMP(6) WHERE task_id=? OR person_id=?", ids[1], ids[0]);
            });
        }
    }
}
