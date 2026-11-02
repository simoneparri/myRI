package it.myri;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

class DomainApiTest extends IntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    MockHttpSession session;

    @BeforeEach
    void login() throws Exception {
        session = new MockHttpSession();
        mvc.perform(post("/api/v1/auth/login").session(session).with(csrf())
                .param("username", "owner").param("password", "fictitious-test-password"))
                .andExpect(status().isNoContent());
    }

    @Test
    void peopleCrudValidationPagingAndOptimisticVersion() throws Exception {
        var body = personInput();
        var person = send(post("/api/v1/people"), body, 201);
        String id = person.get("id").asText();
        assertTrue(person.get("id").isTextual());
        body.put("version", person.get("version").asText());
        body.put("role", "Lead");
        var changed = send(put("/api/v1/people/" + id), body, 200);
        assertEquals("Lead", changed.get("role").asText());
        send(put("/api/v1/people/" + id), body, 409);
        mvc.perform(get("/api/v1/people").session(session).param("q", body.get("lastName").toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/people").session(session).param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/people").session(session).param("sort", "passwordHash,asc"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/people").session(session).param("status", "invalid"))
                .andExpect(status().isBadRequest());
        send(post("/api/v1/people/" + id + "/archive"), Map.of("version", changed.get("version").asText()), 200);
        mvc.perform(get("/api/v1/people").session(session).param("q", body.get("lastName").toString()))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/people").session(session).param("q", body.get("lastName").toString())
                .param("includeArchived", "true")).andExpect(jsonPath("$.totalElements").value(1));
        send(put("/api/v1/people/" + id), body, 409);
        mvc.perform(delete("/api/v1/people/" + id).session(session).with(csrf()))
                .andExpect(status().isMethodNotAllowed());
        var invalid = personInput();
        invalid.put("email", "not-an-email");
        send(post("/api/v1/people"), invalid, 400);
        var unknown = personInput();
        unknown.put("passwordHash", "should-not-bind");
        send(post("/api/v1/people"), unknown, 400);
        mvc.perform(post("/api/v1/people").session(session)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(personInput())))
                .andExpect(status().isForbidden());
    }

    @Test
    void managerCyclesAndInternalExternalConflictAreRejected() throws Exception {
        var aBody = personInput();
        var a = send(post("/api/v1/people"), aBody, 201);
        var bBody = personInput();
        bBody.put("managerId", a.get("id").asText());
        var b = send(post("/api/v1/people"), bBody, 201);
        aBody.put("version", a.get("version").asText());
        aBody.put("managerId", b.get("id").asText());
        send(put("/api/v1/people/" + a.get("id").asText()), aBody, 409);
        aBody.put("managerId", a.get("id").asText());
        send(put("/api/v1/people/" + a.get("id").asText()), aBody, 409);
        aBody.put("managerId", b.get("id").asText());
        aBody.put("externalManager", "External");
        send(put("/api/v1/people/" + a.get("id").asText()), aBody, 400);
    }

    @Test
    void contactAndCareerTalkCrudAreVersionedAndCannotMovePersons() throws Exception {
        String person = person();
        var contact = send(post("/api/v1/people/" + person + "/contacts"),
                Map.of("type", "reference", "value", "fiction"), 201);
        String path = "/api/v1/contacts/" + contact.get("id").asText();
        var changed = send(put(path), Map.of("type", "email", "value", "fiction@example.invalid",
                "version", contact.get("version").asText()), 200);
        send(post(path + "/archive"), Map.of("version", changed.get("version").asText()), 200);
        mvc.perform(get("/api/v1/people/" + person + "/contacts").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        var talkBody = new HashMap<String, Object>();
        talkBody.put("personId", person);
        talkBody.put("heldAt", "2026-01-15T10:00:00Z");
        talkBody.put("topics", "Fictitious career");
        var talk = send(post("/api/v1/career-talks"), talkBody, 201);
        talkBody.put("version", talk.get("version").asText());
        talkBody.put("personId", person());
        send(put("/api/v1/career-talks/" + talk.get("id").asText()), talkBody, 409);
        talkBody.put("personId", person);
        talkBody.put("topics", "Changed");
        var updated = send(put("/api/v1/career-talks/" + talk.get("id").asText()), talkBody, 200);
        send(post("/api/v1/career-talks/" + talk.get("id").asText() + "/archive"),
                Map.of("version", updated.get("version").asText()), 200);
    }

    @Test
    void salaryIsAppendOnlyIdempotentAndAuditedWithoutSensitiveSnapshots() throws Exception {
        String person = person();
        var body = salaryInput();
        var salary = send(post("/api/v1/people/" + person + "/salaries"), body, 201);
        var retry = send(post("/api/v1/people/" + person + "/salaries"), body, 201);
        assertEquals(salary.get("id"), retry.get("id"));
        assertEquals("50000.00", salary.get("amount").asText());
        body.put("amount", "60000");
        send(post("/api/v1/people/" + person + "/salaries"), body, 409);
        mvc.perform(get("/api/v1/people/" + person + "/salaries").session(session))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/audit").session(session).param("personId", person))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].action").value("salary_created"))
                .andExpect(jsonPath("$.items[0].amount").doesNotExist());
        var invalid = salaryInput();
        invalid.put("currency", "ZZZ");
        send(post("/api/v1/people/" + person + "/salaries"), invalid, 400);
        invalid.put("currency", "EUR");
        invalid.put("amount", "1.001");
        send(post("/api/v1/people/" + person + "/salaries"), invalid, 400);
    }

    @Test
    void submittedRaisesCanBeEditedThenApprovedExactlyOnce() throws Exception {
        String person = person();
        var base = send(post("/api/v1/people/" + person + "/salaries"), salaryInput(), 201);
        var input = raiseInput(person, base.get("id").asText());
        input.put("requestedPercentage", "9");
        send(post("/api/v1/raise-requests"), input, 400);
        input.put("requestedPercentage", "10");
        var request = send(post("/api/v1/raise-requests"), input, 201);
        String path = "/api/v1/raise-requests/" + request.get("id").asText();
        request = send(post(path + "/submit"), Map.of("version", request.get("version").asText()), 200);
        input.put("version", request.get("version").asText());
        input.put("motivation", "Edited after submission");
        request = send(put(path), input, 200);
        assertEquals("submitted", request.get("status").asText());
        var outcome = new HashMap<String, Object>();
        outcome.put("version", request.get("version").asText());
        outcome.put("outcomeOn", "2026-02-01");
        outcome.put("createSalary", true);
        outcome.put("effectiveOn", "2026-03-01");
        var approved = send(post(path + "/approve"), outcome, 200);
        var retry = send(post(path + "/approve"), outcome, 200);
        assertEquals(approved.get("salaryId"), retry.get("salaryId"));
        assertFalse(approved.get("salaryId").isNull());
        outcome.put("effectiveOn", "2026-04-01");
        send(post(path + "/approve"), outcome, 409);
        input.put("version", approved.get("version").asText());
        send(put(path), input, 409);
        send(post(path + "/reopen"), Map.of("version", approved.get("version").asText()), 409);
        mvc.perform(get("/api/v1/people/" + person + "/salaries").session(session))
                .andExpect(jsonPath("$.totalElements").value(2));
        assertEquals(6, jdbc.queryForObject("SELECT COUNT(*) FROM audit_event WHERE person_id = ?", Long.class, person));
    }

    @Test
    void approvalWithoutSalaryIsExplicitAndPostponedCanReopenButRejectedCannot() throws Exception {
        String person = person();
        var base = send(post("/api/v1/people/" + person + "/salaries"), salaryInput(), 201);
        var request = send(post("/api/v1/raise-requests"), raiseInput(person, base.get("id").asText()), 201);
        String path = "/api/v1/raise-requests/" + request.get("id").asText();
        request = send(post(path + "/submit"), Map.of("version", request.get("version").asText()), 200);
        request = send(post(path + "/postpone"), Map.of("version", request.get("version").asText(),
                "outcomeOn", "2026-02-01"), 200);
        request = send(post(path + "/reopen"), Map.of("version", request.get("version").asText()), 200);
        assertTrue(request.get("outcomeOn").isNull());
        request = send(post(path + "/submit"), Map.of("version", request.get("version").asText()), 200);
        var approved = send(post(path + "/approve"), Map.of("version", request.get("version").asText(),
                "outcomeOn", "2026-02-01", "createSalary", false), 200);
        assertTrue(approved.get("salaryId").isNull());
        mvc.perform(get("/api/v1/people/" + person + "/salaries").session(session))
                .andExpect(jsonPath("$.totalElements").value(1));
        var second = send(post("/api/v1/raise-requests"), raiseInput(person, base.get("id").asText()), 201);
        String otherPath = "/api/v1/raise-requests/" + second.get("id").asText();
        second = send(post(otherPath + "/submit"), Map.of("version", second.get("version").asText()), 200);
        second = send(post(otherPath + "/reject"), Map.of("version", second.get("version").asText(),
                "outcomeOn", "2026-02-01"), 200);
        send(post(otherPath + "/reopen"), Map.of("version", second.get("version").asText()), 409);
    }

    @Test
    void taskLinksAreCoherentCompletionIsIdempotentAndCreatesOneSuccessor() throws Exception {
        String person = person();
        var talk = send(post("/api/v1/career-talks"),
                Map.of("personId", person, "heldAt", "2026-01-15T10:00:00Z"), 201);
        var input = taskInput();
        input.put("careerTalkId", talk.get("id").asText());
        var task = send(post("/api/v1/tasks"), input, 201);
        assertEquals(person, task.get("personId").asText());
        input.put("personId", person());
        send(post("/api/v1/tasks"), input, 400);
        String path = "/api/v1/tasks/" + task.get("id").asText();
        var completion = send(post(path + "/complete"), Map.of("version", task.get("version").asText()), 200);
        var retry = send(post(path + "/complete"), Map.of("version", task.get("version").asText()), 200);
        assertEquals(completion.get("nextOccurrence").get("id"), retry.get("nextOccurrence").get("id"));
        assertTrue(Instant.parse(completion.get("nextOccurrence").get("dueAt").asText()).isAfter(Instant.now()));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM task WHERE source_task_id = ?", Long.class,
                task.get("id").asText()));
    }

    @Test
    void timelineHasAllTypesAndFiltersPaginationAndCalendarDates() throws Exception {
        String person = person();
        var salary = send(post("/api/v1/people/" + person + "/salaries"), salaryInput(), 201);
        send(post("/api/v1/raise-requests"), raiseInput(person, salary.get("id").asText()), 201);
        send(post("/api/v1/career-talks"), Map.of("personId", person, "heldAt", "2026-01-15T10:00:00Z"), 201);
        var task = taskInput();
        task.put("personId", person);
        send(post("/api/v1/tasks"), task, 201);
        mvc.perform(get("/api/v1/people/" + person + "/timeline").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.items[0].kind").value("raise_request"));
        mvc.perform(get("/api/v1/people/" + person + "/timeline").session(session)
                .param("kinds", "salary").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].eventDate").value("2025-01-01"));
        mvc.perform(get("/api/v1/people/" + person + "/timeline").session(session)
                .param("kinds", "invalid")).andExpect(status().isBadRequest());
    }

    @Test
    void openApiDescribesProtectedDomainAndPreciseNumbers() throws Exception {
        mvc.perform(get("/v3/api-docs").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/people']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/raise-requests/{id}/approve']").exists())
                .andExpect(jsonPath("$.components.securitySchemes.session.name").value("JSESSIONID"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post").exists())
                .andExpect(jsonPath("$.components.schemas.PersonView.properties.id.type").value("string"))
                .andExpect(jsonPath("$.components.schemas.SalaryView.properties.amount.type").value("string"))
                .andExpect(jsonPath("$.components.schemas.TaskView.properties.title").exists());
    }

    @Test
    void notificationsAreFilteredReadAndArchivedButCannotBeCreatedViaApi() throws Exception {
        String person = person();
        long id;
        try (var connection = java.sql.DriverManager.getConnection(
                MYSQL.getJdbcUrl(), "root", MYSQL.getPassword());
                var sql = connection.prepareStatement("""
                        INSERT INTO notification (kind, deduplication_key, person_id, triggered_at)
                        VALUES ('career_talk_due', ?, ?, '2026-02-01')
                        """, java.sql.Statement.RETURN_GENERATED_KEYS)) {
            sql.setString(1, UUID.randomUUID().toString());
            sql.setString(2, person);
            sql.executeUpdate();
            try (var keys = sql.getGeneratedKeys()) {
                assertTrue(keys.next());
                id = keys.getLong(1);
            }
        }
        var read = send(post("/api/v1/notifications/" + id + "/read"), Map.of("version", "0"), 200);
        assertFalse(read.get("readAt").isNull());
        send(post("/api/v1/notifications/" + id + "/archive"),
                Map.of("version", read.get("version").asText()), 200);
        mvc.perform(get("/api/v1/notifications").session(session).param("unreadOnly", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(post("/api/v1/notifications").session(session).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isMethodNotAllowed());
    }

    @Test
    void runtimeUserCannotDeleteOrModifyHistoryOrExecuteDdl() {
        var denied = assertThrows(org.springframework.dao.DataAccessException.class,
                () -> jdbc.update("DELETE FROM person WHERE id = -1"));
        assertNotNull(denied);
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> jdbc.update("UPDATE salary SET amount = 1 WHERE id = -1"));
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> jdbc.update("UPDATE audit_event SET action = 'raise_updated' WHERE id = -1"));
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> jdbc.execute("CREATE TABLE forbidden_table (id BIGINT)"));
    }

    String person() throws Exception { return send(post("/api/v1/people"), personInput(), 201).get("id").asText(); }

    static Map<String, Object> personInput() {
        var input = new HashMap<String, Object>();
        input.put("firstName", "Fictitious");
        input.put("lastName", UUID.randomUUID().toString());
        input.put("hiredOn", "2020-01-01");
        input.put("status", "active");
        return input;
    }

    static Map<String, Object> salaryInput() {
        return new HashMap<>(Map.of("amount", "50000.00", "currency", "EUR",
                "effectiveOn", "2025-01-01", "reason", "Fictitious salary",
                "requestKey", UUID.randomUUID().toString()));
    }

    static Map<String, Object> raiseInput(String person, String salary) {
        return new HashMap<>(Map.of("personId", person, "baseSalaryId", salary,
                "requestedOn", "2026-02-01", "requestedSalary", "55000.00", "motivation", "Fictitious raise"));
    }

    static Map<String, Object> taskInput() {
        return new HashMap<>(Map.of("title", "Fictitious task", "dueAt", "2026-01-31T09:00:00Z",
                "priority", "medium", "status", "todo", "recurrenceFrequency", "monthly", "recurrenceInterval", 1));
    }

    JsonNode send(MockHttpServletRequestBuilder request, Object body, int expected) throws Exception {
        var response = mvc.perform(request.session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(body))).andExpect(status().is(expected)).andReturn().getResponse();
        return json.readTree(response.getContentAsString());
    }
}
