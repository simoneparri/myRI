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
        body.put("frameworks", List.of("Java", "Spring Boot"));
        var person = send(post("/api/v1/people"), body, 201);
        String id = person.get("id").asText();
        assertTrue(person.get("id").isTextual());
        assertEquals("Sede fittizia", person.get("hiringLocation").asText());
        assertEquals("Residenza fittizia", person.get("residence").asText());
        assertEquals(List.of("Java", "Spring Boot"),
                json.convertValue(person.get("frameworks"), json.getTypeFactory().constructCollectionType(List.class, String.class)));
        assertTrue(person.get("seniority").asText().matches("\\d+ anni e \\d+ mesi"));
        body.put("version", person.get("version").asText());
        body.put("role", "Lead");
        var changed = send(put("/api/v1/people/" + id), body, 200);
        assertEquals("Lead", changed.get("role").asText());
        assertEquals(List.of("Java", "Spring Boot"), json.convertValue(changed.get("frameworks"),
                json.getTypeFactory().constructCollectionType(List.class, String.class)));
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
        invalid = personInput();
        invalid.put("frameworks", List.of("Java", " java "));
        send(post("/api/v1/people"), invalid, 400);
        invalid = personInput();
        invalid.put("frameworks", Collections.nCopies(51, "Framework"));
        send(post("/api/v1/people"), invalid, 400);
        invalid = personInput();
        invalid.put("frameworks", List.of("F".repeat(101)));
        send(post("/api/v1/people"), invalid, 400);
        var unknown = personInput();
        unknown.put("passwordHash", "should-not-bind");
        send(post("/api/v1/people"), unknown, 400);
        mvc.perform(post("/api/v1/people").session(session)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(personInput())))
                .andExpect(status().isForbidden());
    }

    @Test
    void personCareerMypadValidationAndExportsPreserveDistinctFields() throws Exception {
        var input = personInput();
        input.put("frameworks", List.of("Java", "Spring Boot"));
        var person = send(post("/api/v1/people"), input, 201);
        String path = "/api/v1/people/" + person.get("id").asText();
        assertEquals("2018-01-01", person.get("careerStartedOn").asText());
        assertEquals("medior", person.get("seniorityLevel").asText());
        assertEquals(input.get("mypadId"), person.get("mypadId").asText());
        assertEquals(List.of("Java", "Spring Boot"), json.convertValue(person.get("frameworks"),
                json.getTypeFactory().constructCollectionType(List.class, String.class)));
        assertNotEquals(person.get("id").asText(), person.get("mypadId").asText());
        assertTrue(person.get("careerDuration").asText().matches("\\d+ anni e \\d+ mesi"));
        input.put("version", person.get("version").asText());
        input.put("seniorityLevel", "senior");
        var updated = send(put(path), input, 200);
        assertEquals("senior", updated.get("seniorityLevel").asText());
        assertEquals(person.get("id"), updated.get("id"));
        var duplicate = personInput();
        duplicate.put("mypadId", input.get("mypadId"));
        send(post("/api/v1/people"), duplicate, 409);

        var invalid = personInput();
        invalid.remove("mypadId");
        send(post("/api/v1/people"), invalid, 400);
        invalid.put("mypadId", "../invalid");
        send(post("/api/v1/people"), invalid, 400);
        invalid.put("mypadId", "a".repeat(101));
        send(post("/api/v1/people"), invalid, 400);
        invalid.put("mypadId", UUID.randomUUID().toString());
        invalid.put("seniorityLevel", "expert");
        send(post("/api/v1/people"), invalid, 400);
        invalid.put("seniorityLevel", "junior");
        invalid.put("careerStartedOn", "2021-01-01");
        send(post("/api/v1/people"), invalid, 400);

        mvc.perform(get(path + "/export").session(session).param("format", "json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.person.mypadId").value(input.get("mypadId")))
                .andExpect(jsonPath("$.person.seniorityLevel").value("senior"))
                .andExpect(jsonPath("$.person.hiredOn").value("2020-01-01"))
                .andExpect(jsonPath("$.person.careerStartedOn").value("2018-01-01"));
        String csv = mvc.perform(get(path + "/export").session(session).param("format", "csv"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("\"careerStartedOn\""));
        assertTrue(csv.contains("\"seniorityLevel\""));
        assertTrue(csv.contains("\"mypadId\""));
        assertTrue(csv.contains("\"Java, Spring Boot\""));

        var withoutFrameworks = new HashMap<>(input);
        withoutFrameworks.remove("frameworks");
        withoutFrameworks.put("version", updated.get("version").asText());
        var unchangedFrameworks = send(put(path), withoutFrameworks, 200);
        assertEquals(List.of("Java", "Spring Boot"),
                json.convertValue(unchangedFrameworks.get("frameworks"),
                        json.getTypeFactory().constructCollectionType(List.class, String.class)));

        var frameworkUpdate = personInput();
        frameworkUpdate.put("version", unchangedFrameworks.get("version").asText());
        frameworkUpdate.put("mypadId", input.get("mypadId"));
        frameworkUpdate.put("frameworks", List.of("Kotlin"));
        var frameworksChanged = send(put(path), frameworkUpdate, 200);
        assertEquals("Kotlin", frameworksChanged.get("frameworks").get(0).asText());
        String frameworkCsv = mvc.perform(get(path + "/export").session(session).param("format", "csv"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(frameworkCsv.contains("\"Kotlin\""));

        send(post(path + "/archive"), Map.of("version", frameworksChanged.get("version").asText()), 200);
        send(post("/api/v1/people"), duplicate, 409);
    }

    @Test
    void birthDateIsValidatedAndIncludedWithDerivedAgeInPersonAndExports() throws Exception {
        var input = personInput();
        input.remove("bornOn");
        send(post("/api/v1/people"), input, 400);
        for (String invalid : List.of("0999-01-01", "9999-12-31", "1990-02-30")) {
            input.put("bornOn", invalid);
            send(post("/api/v1/people"), input, 400);
        }
        input.put("bornOn", "1990-11-05");
        var person = send(post("/api/v1/people"), input, 201);
        assertEquals("1990-11-05", person.get("bornOn").asText());
        assertTrue(person.get("age").isIntegralNumber());
        String path = "/api/v1/people/" + person.get("id").asText();
        mvc.perform(get(path).session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.bornOn").value("1990-11-05"))
                .andExpect(jsonPath("$.age").value(person.get("age").asInt()));
        input.put("version", person.get("version").asText());
        input.remove("bornOn");
        send(put(path), input, 400);
        input.put("bornOn", "1991-11-05");
        var changed = send(put(path), input, 200);
        assertEquals("1991-11-05", changed.get("bornOn").asText());
        mvc.perform(get(path + "/export").session(session).param("format", "json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.person.bornOn").value("1991-11-05"))
                .andExpect(jsonPath("$.person.age").value(changed.get("age").asInt()));
        String csv = mvc.perform(get(path + "/export").session(session).param("format", "csv"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("\"bornOn\""));
        assertTrue(csv.contains("\"age\""));
        assertTrue(csv.contains("\"1991-11-05\""));
    }

    @Test
    void personIdentifiersAndEducationAreValidatedUniqueAndExported() throws Exception {
        var input = personInput();
        for (String field : List.of("rsnoAgresso", "insideId", "education")) {
            var missing = new HashMap<>(input);
            missing.remove(field);
            send(post("/api/v1/people"), missing, 400);
        }
        for (String field : List.of("rsnoAgresso", "insideId")) {
            for (String invalid : List.of("", " ", "a\nb", "x".repeat(101))) {
                var invalidInput = new HashMap<>(input);
                invalidInput.put(field, invalid);
                send(post("/api/v1/people"), invalidInput, 400);
            }
        }
        input.put("education", "invalid");
        send(post("/api/v1/people"), input, 400);
        input.put("education", "bachelor");
        var person = send(post("/api/v1/people"), input, 201);
        String path = "/api/v1/people/" + person.get("id").asText();
        assertEquals(input.get("rsnoAgresso"), person.get("rsnoAgresso").asText());
        assertEquals(input.get("insideId"), person.get("insideId").asText());
        assertEquals("bachelor", person.get("education").asText());
        for (String field : List.of("rsnoAgresso", "insideId")) {
            var duplicate = personInput();
            duplicate.put(field, input.get(field));
            send(post("/api/v1/people"), duplicate, 409);
            var other = send(post("/api/v1/people"), personInput(), 201);
            var update = personInput();
            update.put("version", other.get("version").asText());
            update.put(field, input.get(field));
            send(put("/api/v1/people/" + other.get("id").asText()), update, 409);
        }
        for (String field : List.of("rsnoAgresso", "insideId", "education")) {
            var cleared = new HashMap<>(input);
            cleared.remove(field);
            cleared.put("version", person.get("version").asText());
            send(put(path), cleared, 400);
        }
        input.put("version", person.get("version").asText());
        input.put("education", "phd");
        var updated = send(put(path), input, 200);
        assertEquals("phd", updated.get("education").asText());
        mvc.perform(get(path + "/export").session(session).param("format", "json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.person.rsnoAgresso").value(input.get("rsnoAgresso")))
                .andExpect(jsonPath("$.person.insideId").value(input.get("insideId")))
                .andExpect(jsonPath("$.person.education").value("phd"));
        String csv = mvc.perform(get(path + "/export").session(session).param("format", "csv"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("\"rsnoAgresso\""));
        assertTrue(csv.contains("\"insideId\""));
        assertTrue(csv.contains("\"education\""));
        send(post(path + "/archive"), Map.of("version", updated.get("version").asText()), 200);
        for (String field : List.of("rsnoAgresso", "insideId")) {
            var duplicate = personInput();
            duplicate.put(field, input.get(field));
            send(post("/api/v1/people"), duplicate, 409);
        }
    }

    @Test
    void legacyPersonCanBeUpdatedWithoutInventingCareerLevelOrMypadIdentity() throws Exception {
        String suffix = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO person(first_name,last_name,hired_on,status,version) VALUES('Fictitious',?,'2020-01-01','active',0)", suffix);
        Long id = jdbc.queryForObject("SELECT id FROM person WHERE last_name = ?", Long.class, suffix);
        var input = personInput();
        input.remove("mypadId");
        input.remove("careerStartedOn");
        input.remove("seniorityLevel");
        input.remove("bornOn");
        input.remove("rsnoAgresso");
        input.remove("insideId");
        input.remove("education");
        input.put("version", "0");
        var updated = send(put("/api/v1/people/" + id), input, 200);
        assertTrue(updated.get("careerStartedOn").isNull());
        assertTrue(updated.get("careerDuration").isNull());
        assertTrue(updated.get("bornOn").isNull());
        assertTrue(updated.get("age").isNull());
        assertTrue(updated.get("seniorityLevel").isNull());
        assertTrue(updated.get("mypadId").isNull());
        assertTrue(updated.get("rsnoAgresso").isNull());
        assertTrue(updated.get("insideId").isNull());
        assertTrue(updated.get("education").isNull());
        input.put("version", updated.get("version").asText());
        input.put("mypadId", "fictitious-" + suffix);
        var identified = send(put("/api/v1/people/" + id), input, 200);
        assertEquals("fictitious-" + suffix, identified.get("mypadId").asText());
        assertEquals(id.toString(), identified.get("id").asText());
        input.put("version", identified.get("version").asText());
        input.remove("mypadId");
        send(put("/api/v1/people/" + id), input, 400);
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
    void contactsRequireDatesAndPageNewestFirstWithLegacyContactsLast() throws Exception {
        String person = person();
        String path = "/api/v1/people/" + person + "/contacts";
        send(post(path), Map.of("type", "reference", "value", "Fictitious"), 400);
        send(post(path), Map.of("type", "reference", "value", "Fictitious",
                "contactedOn", "2026-02-30"), 400);
        send(post(path), Map.of("type", "reference", "value", "Fictitious",
                "contactedOn", "0999-01-01"), 400);
        jdbc.update("INSERT INTO contact (person_id,type,value) VALUES (?,'reference','Legacy fictitious')", person);
        String legacy = jdbc.queryForObject("SELECT id FROM contact WHERE person_id = ?", String.class, person);
        send(put("/api/v1/contacts/" + legacy),
                Map.of("type", "reference", "value", "Legacy edited", "version", "0"), 200);
        var old = send(post(path), Map.of("type", "reference", "value", "Old fictitious",
                "contactedOn", "2025-01-01"), 201);
        var recent = send(post(path), Map.of("type", "reference", "value", "Recent fictitious",
                "contactedOn", "2026-11-05"), 201);
        var sameDay = send(post(path), Map.of("type", "reference", "value", "Same day fictitious",
                "contactedOn", "2026-11-05"), 201);
        mvc.perform(get(path).session(session).param("size", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.items[0].id").value(recent.get("id").asText()))
                .andExpect(jsonPath("$.items[1].id").value(sameDay.get("id").asText()));
        mvc.perform(get(path).session(session).param("size", "2").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(old.get("id").asText()))
                .andExpect(jsonPath("$.items[1].id").value(legacy))
                .andExpect(jsonPath("$.items[1].contactedOn").isEmpty());
        send(put("/api/v1/contacts/" + recent.get("id").asText()),
                Map.of("type", "reference", "value", "Fictitious", "version", "0"), 400);
        var changed = send(put("/api/v1/contacts/" + old.get("id").asText()),
                Map.of("type", "reference", "value", "Updated fictitious", "version", "0",
                        "contactedOn", "2026-12-01"), 200);
        assertEquals("2026-12-01", changed.get("contactedOn").asText());
        mvc.perform(get(path).session(session).param("q", "Updated"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].contactedOn").value("2026-12-01"));
        mvc.perform(get("/api/v1/people/" + person + "/export").session(session).param("format", "json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contacts[?(@.contactedOn == '2026-12-01')]").isNotEmpty());
        String csv = mvc.perform(get("/api/v1/people/" + person + "/export")
                .session(session).param("format", "csv")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("\"contactedOn\""));
        assertTrue(csv.contains("\"2026-12-01\""));
    }

    @Test
    void contactAndCareerTalkCrudAreVersionedAndCannotMovePersons() throws Exception {
        String person = person();
        var contact = send(post("/api/v1/people/" + person + "/contacts"),
                Map.of("type", "reference", "value", "fiction", "contactedOn", "2026-11-05"), 201);
        String path = "/api/v1/contacts/" + contact.get("id").asText();
        var changed = send(put(path), Map.of("type", "email", "value", "fiction@example.invalid",
                "version", contact.get("version").asText(), "contactedOn", "2026-11-05"), 200);
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
    void proposedBenefitsAreInheritedEditableAuditedAndAppliedOnlyToNewSalary() throws Exception {
        String person = person();
        var salaryBody = salaryInput();
        salaryBody.put("mealVouchers", true);
        salaryBody.put("bonusLetterAmount", "1200.00");
        salaryBody.put("companyCar", false);
        var base = send(post("/api/v1/people/" + person + "/salaries"), salaryBody, 201);
        var body = raiseInput(person, base.get("id").asText());
        var request = send(post("/api/v1/raise-requests"), body, 201);
        assertTrue(request.get("benefits").get("mealVouchers").asBoolean());
        assertEquals("1200.00", request.get("benefits").get("bonusLetterAmount").asText());
        String path = "/api/v1/raise-requests/" + request.get("id").asText();
        body.put("version", request.get("version").asText());
        body.put("benefits", Map.of("mealVouchers", false, "bonusLetterAmount", "0.00", "companyCar", true));
        request = send(put(path), body, 200);
        assertFalse(request.get("benefits").get("mealVouchers").asBoolean());
        body.put("version", request.get("version").asText());
        body.put("benefits", Map.of("mealVouchers", false, "bonusLetterAmount", "0.0", "companyCar", true));
        assertEquals(request.get("version"), send(put(path), body, 200).get("version"));
        request = send(post(path + "/submit"), Map.of("version", request.get("version").asText()), 200);
        body.put("version", request.get("version").asText());
        body.put("benefits", Map.of("companyCar", true));
        request = send(put(path), body, 200);
        assertTrue(request.get("benefits").get("bonusLetterAmount").isNull());
        assertTrue(request.get("benefits").get("mealVouchers").isNull());
        body.remove("benefits");
        body.put("version", request.get("version").asText());
        body.put("motivation", "Fictitious revision");
        request = send(put(path), body, 200);
        assertTrue(request.get("benefits").get("companyCar").asBoolean());
        var command = Map.of("version", request.get("version").asText(),
                "outcomeOn", "2026-02-01", "createSalary", true, "effectiveOn", "2026-03-01");
        var approval = send(post(path + "/approve"), command, 200);
        assertEquals(approval.get("salaryId"), send(post(path + "/approve"), command, 200).get("salaryId"));
        var rows = mvc.perform(get("/api/v1/people/" + person + "/salaries").session(session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(json.readTree(rows).get("items").get(0).get("companyCar").asBoolean());
        assertTrue(json.readTree(rows).get("items").get(0).get("bonusLetterAmount").isNull());
        assertEquals("1200.00", json.readTree(rows).get("items").get(1).get("bonusLetterAmount").asText());
        body.put("version", approval.get("version").asText());
        body.put("benefits", Map.of());
        send(put(path), body, 409);
        assertEquals(2, jdbc.queryForObject("""
                SELECT COUNT(*) FROM audit_event WHERE raise_request_id = ?
                AND action = 'raise_updated' AND changed_fields = 'benefits'
                """, Integer.class, request.get("id").asText()));
        mvc.perform(get("/api/v1/audit").session(session).param("personId", person))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].benefits").doesNotExist());
        mvc.perform(get("/api/v1/people/" + person + "/export").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.raiseRequests[0].benefits.companyCar").value(true));
        String csv = mvc.perform(get("/api/v1/people/" + person + "/export")
                .session(session).param("format", "csv")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("\"\"companyCar\"\":true"));
        for (String invalid : List.of("-1", "1.001", "10000000000.00")) {
            var invalidBody = raiseInput(person, base.get("id").asText());
            invalidBody.put("benefits", Map.of("bonusLetterAmount", invalid));
            send(post("/api/v1/raise-requests"), invalidBody, 400);
        }
        var emptyBody = raiseInput(person, base.get("id").asText());
        emptyBody.put("benefits", Map.of());
        var empty = send(post("/api/v1/raise-requests"), emptyBody, 201);
        assertTrue(empty.get("benefits").get("mealVouchers").isNull());
    }

    @Test
    void legacyRaiseWithoutSavedProposalStillInheritsBaseBenefitsOnApproval() throws Exception {
        String person = person();
        var input = salaryInput();
        input.put("mealVouchers", true);
        input.put("companyCar", false);
        var base = send(post("/api/v1/people/" + person + "/salaries"), input, 201);
        var request = send(post("/api/v1/raise-requests"), raiseInput(person, base.get("id").asText()), 201);
        String path = "/api/v1/raise-requests/" + request.get("id").asText();
        jdbc.update("""
                UPDATE raise_request SET benefits_specified = FALSE,
                meal_vouchers = NULL, bonus_letter_amount = NULL, company_car = NULL WHERE id = ?
                """, request.get("id").asText());
        mvc.perform(get(path).session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.benefits").isEmpty());
        request = send(post(path + "/submit"), Map.of("version", request.get("version").asText()), 200);
        send(post(path + "/approve"), Map.of("version", request.get("version").asText(),
                "outcomeOn", "2026-02-01", "createSalary", true, "effectiveOn", "2026-03-01"), 200);
        mvc.perform(get("/api/v1/people/" + person + "/salaries").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].mealVouchers").value(true))
                .andExpect(jsonPath("$.items[0].companyCar").value(false));
    }

    @Test
    void salaryBenefitsAreOptionalValidatedExportedAndPartOfIdempotency() throws Exception {
        String person = person();
        String path = "/api/v1/people/" + person + "/salaries";
        var empty = send(post(path), salaryInput(), 201);
        assertTrue(empty.get("mealVouchers").isNull());
        assertTrue(empty.get("bonusLetterAmount").isNull());
        assertTrue(empty.get("companyCar").isNull());
        var body = salaryInput();
        body.put("mealVouchers", true);
        body.put("bonusLetterAmount", "1200.50");
        body.put("companyCar", false);
        var salary = send(post(path), body, 201);
        assertTrue(salary.get("mealVouchers").asBoolean());
        assertEquals("1200.50", salary.get("bonusLetterAmount").asText());
        assertFalse(salary.get("companyCar").asBoolean());
        body.put("bonusLetterAmount", "1200.5");
        assertEquals(salary.get("id"), send(post(path), body, 201).get("id"));
        for (String field : List.of("mealVouchers", "companyCar", "bonusLetterAmount")) {
            var changed = new HashMap<>(body);
            changed.put(field, field.equals("bonusLetterAmount") ? "0.00" : !((Boolean) body.get(field)));
            send(post(path), changed, 409);
        }
        for (String invalid : List.of("-0.01", "1.001", "10000000000.00")) {
            var bad = salaryInput();
            bad.put("bonusLetterAmount", invalid);
            send(post(path), bad, 400);
        }
        var zero = salaryInput();
        zero.put("bonusLetterAmount", "0");
        assertEquals(0, new java.math.BigDecimal(send(post(path), zero, 201)
                .get("bonusLetterAmount").asText()).signum());
        mvc.perform(get("/api/v1/people/" + person + "/export").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.salaries[1].mealVouchers").value(true))
                .andExpect(jsonPath("$.salaries[1].bonusLetterAmount").value("1200.50"))
                .andExpect(jsonPath("$.salaries[1].companyCar").value(false));
        String csv = mvc.perform(get("/api/v1/people/" + person + "/export")
                .session(session).param("format", "csv")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("\"bonusLetterAmount\""));
        assertTrue(csv.contains("\"1200.50\""));
        mvc.perform(get("/api/v1/people/" + person + "/salary-trend").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[1].mealVouchers").value(true));
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> jdbc.update("UPDATE salary SET company_car = 1 WHERE id = ?", salary.get("id").asLong()));
        mvc.perform(get("/api/v1/audit").session(session).param("salaryId", salary.get("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].changedFields").value(org.hamcrest.Matchers.containsString("bonusLetterAmount")))
                .andExpect(jsonPath("$.items[0].bonusLetterAmount").doesNotExist());
    }

    @Test
    void approvalCanInheritOverrideOrClearBenefitsWithoutChangingTheBase() throws Exception {
        for (boolean override : new boolean[] { false, true }) {
            String person = person();
            String salariesPath = "/api/v1/people/" + person + "/salaries";
            var salaryBody = salaryInput();
            salaryBody.put("mealVouchers", true);
            salaryBody.put("bonusLetterAmount", "1500.00");
            salaryBody.put("companyCar", false);
            var base = send(post(salariesPath), salaryBody, 201);
            var request = send(post("/api/v1/raise-requests"), raiseInput(person, base.get("id").asText()), 201);
            String path = "/api/v1/raise-requests/" + request.get("id").asText();
            request = send(post(path + "/submit"), Map.of("version", request.get("version").asText()), 200);
            var command = new HashMap<String, Object>();
            command.put("version", request.get("version").asText());
            command.put("outcomeOn", "2026-02-01");
            command.put("createSalary", true);
            command.put("effectiveOn", "2026-03-01");
            for (String invalid : List.of("-0.01", "1.001", "10000000000.00")) {
                command.put("benefits", Map.of("bonusLetterAmount", invalid));
                send(post(path + "/approve"), command, 400);
            }
            command.put("createSalary", false);
            command.remove("effectiveOn");
            command.put("benefits", Map.of("companyCar", true));
            send(post(path + "/approve"), command, 400);
            command.put("createSalary", true);
            command.put("effectiveOn", "2026-03-01");
            command.remove("benefits");
            if (override) command.put("benefits", Map.of("mealVouchers", false, "companyCar", true));
            var approved = send(post(path + "/approve"), command, 200);
            assertEquals(approved.get("salaryId"), send(post(path + "/approve"), command, 200).get("salaryId"));
            var rows = mvc.perform(get(salariesPath).session(session))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            var generated = json.readTree(rows).get("items").get(0);
            assertEquals(!override, generated.get("mealVouchers").asBoolean());
            assertEquals(override, generated.get("companyCar").asBoolean());
            if (override) assertTrue(generated.get("bonusLetterAmount").isNull());
            else assertEquals("1500.00", generated.get("bonusLetterAmount").asText());
            assertEquals("1500.00", json.readTree(rows).get("items").get(1).get("bonusLetterAmount").asText());
            command.put("benefits", Map.of("bonusLetterAmount", "0.00"));
            send(post(path + "/approve"), command, 409);
        }
    }

    @Test
    void salaryIsAppendOnlyIdempotentAndAuditedWithoutSensitiveSnapshots() throws Exception {
        String person = person();
        var body = salaryInput();
        var salary = send(post("/api/v1/people/" + person + "/salaries"), body, 201);
        assertEquals("Tempo indeterminato", salary.get("contractType").asText());
        assertEquals("40.00", salary.get("weeklyHours").asText());
        assertEquals("Livello fittizio", salary.get("classificationLevel").asText());
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
        invalid.put("amount", "50000");
        invalid.put("weeklyHours", "168.01");
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
        input.put("version", request.get("version").asText());
        var noChange = send(put(path), input, 200);
        assertEquals(request.get("version"), noChange.get("version"));
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
        var salaryRows = mvc.perform(get("/api/v1/people/" + person + "/salaries").session(session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode generatedSalary = null;
        for (JsonNode item : json.readTree(salaryRows).get("items")) {
            if (!item.get("sourceRaiseRequestId").isNull()) {
                generatedSalary = item;
                break;
            }
        }
        assertNotNull(generatedSalary);
        assertEquals("Tempo indeterminato", generatedSalary.get("contractType").asText());
        assertEquals("40.00", generatedSalary.get("weeklyHours").asText());
        assertEquals("Livello fittizio", generatedSalary.get("classificationLevel").asText());
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
    void completedTasksRemainIdempotentAfterArchivalButOpenArchivedTasksCannotComplete() throws Exception {
        var task = send(post("/api/v1/tasks"), taskInput(), 201);
        String path = "/api/v1/tasks/" + task.get("id").asText();
        var command = Map.of("version", task.get("version").asText());
        var completion = send(post(path + "/complete"), command, 200);
        send(post(path + "/archive"), Map.of("version", completion.get("task").get("version").asText()), 200);
        var retry = send(post(path + "/complete"), command, 200);
        assertEquals(completion.get("nextOccurrence").get("id"), retry.get("nextOccurrence").get("id"));
        assertFalse(retry.get("task").get("archivedAt").isNull());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM task WHERE source_task_id=?", Integer.class, task.get("id").asText()));
        var open = send(post("/api/v1/tasks"), taskInput(), 201);
        String openPath = "/api/v1/tasks/" + open.get("id").asText();
        send(post(openPath + "/archive"), Map.of("version", open.get("version").asText()), 200);
        send(post(openPath + "/complete"), Map.of("version", open.get("version").asText()), 409);
    }

    @Test
    void approvalsRemainIdempotentAfterArchivalWithoutRepeatingSalaryOrAudit() throws Exception {
        for (boolean createSalary : new boolean[] {true, false}) {
            String person = person();
            var base = send(post("/api/v1/people/" + person + "/salaries"), salaryInput(), 201);
            var request = send(post("/api/v1/raise-requests"), raiseInput(person, base.get("id").asText()), 201);
            String path = "/api/v1/raise-requests/" + request.get("id").asText();
            request = send(post(path + "/submit"), Map.of("version", request.get("version").asText()), 200);
            var command = new HashMap<String, Object>();
            command.put("version", request.get("version").asText());
            command.put("outcomeOn", "2026-02-01");
            command.put("createSalary", createSalary);
            if (createSalary) command.put("effectiveOn", "2026-03-01");
            var approved = send(post(path + "/approve"), command, 200);
            send(post(path + "/archive"), Map.of("version", approved.get("version").asText()), 200);
            long audits = jdbc.queryForObject("SELECT COUNT(*) FROM audit_event WHERE person_id=?", Long.class, person);
            var retry = send(post(path + "/approve"), command, 200);
            assertEquals(approved.get("salaryId"), retry.get("salaryId"));
            assertFalse(retry.get("archivedAt").isNull());
            assertEquals(audits, jdbc.queryForObject("SELECT COUNT(*) FROM audit_event WHERE person_id=?", Long.class, person));
            assertEquals(createSalary ? 2 : 1, jdbc.queryForObject("SELECT COUNT(*) FROM salary WHERE person_id=?", Integer.class, person));
            command.put("outcomeOn", "2026-02-02");
            send(post(path + "/approve"), command, 409);
        }
        String person = person();
        var base = send(post("/api/v1/people/" + person + "/salaries"), salaryInput(), 201);
        var request = send(post("/api/v1/raise-requests"), raiseInput(person, base.get("id").asText()), 201);
        String path = "/api/v1/raise-requests/" + request.get("id").asText();
        request = send(post(path + "/submit"), Map.of("version", request.get("version").asText()), 200);
        request = send(post(path + "/archive"), Map.of("version", request.get("version").asText()), 200);
        send(post(path + "/approve"), Map.of("version", request.get("version").asText(),
                "outcomeOn", "2026-02-01", "createSalary", false), 409);
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
    void invalidCalendarAndFractionalIdentifiersAreRejectedBeforeDatabaseWrites() throws Exception {
        var person = personInput();
        person.put("hiredOn", "0001-01-01");
        send(post("/api/v1/people"), person, 400);
        var task = taskInput();
        task.put("dueAt", "0001-01-01T10:00:00Z");
        send(post("/api/v1/tasks"), task, 400);
        task.put("dueAt", "+1000000000-12-31T23:59:59.999999999Z");
        send(post("/api/v1/tasks"), task, 400);
        mvc.perform(post("/api/v1/career-talks").session(session).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"personId\":1.5,\"heldAt\":\"2026-01-01T10:00:00Z\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/tasks").session(session).param("personId", "-1"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/career-talks").session(session).param("from", "0001-01-01T00:00:00Z"))
                .andExpect(status().isBadRequest());
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
        input.put("bornOn", "1990-01-01");
        input.put("rsnoAgresso", "00-" + UUID.randomUUID());
        input.put("insideId", "00-" + UUID.randomUUID());
        input.put("education", "master");
        input.put("careerStartedOn", "2018-01-01");
        input.put("seniorityLevel", "medior");
        input.put("mypadId", UUID.randomUUID().toString());
        input.put("hiringLocation", "Sede fittizia");
        input.put("residence", "Residenza fittizia");
        input.put("frameworks", List.of());
        input.put("status", "active");
        return input;
    }

    static Map<String, Object> salaryInput() {
        return new HashMap<>(Map.of("amount", "50000.00", "currency", "EUR",
                "effectiveOn", "2025-01-01", "contractType", "Tempo indeterminato",
                "weeklyHours", "40.00", "classificationLevel", "Livello fittizio",
                "reason", "Fictitious salary",
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
