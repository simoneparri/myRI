package it.myri;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@Import(ProjectApiTest.Time.class)
@Transactional
@WithMockUser(roles = "OWNER")
class ProjectApiTest extends IntegrationTest {
    @TestConfiguration
    static class Time {
        @Bean @Primary Clock projectClock() {
            return Clock.fixed(Instant.parse("2026-11-04T23:30:00Z"), ZoneOffset.UTC);
        }
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private String person() throws Exception {
        return send(post("/api/v1/people"), DomainApiTest.personInput(), 201).get("id").asText();
    }

    @Test
    void projectCrudPreservesHistoryFiltersPeriodsAndExportsAllProjects() throws Exception {
        String person = person();
        String path = "/api/v1/people/" + person + "/projects";
        var current = send(post(path), input("2026-11-05", "2026-11-05"), 201);
        assertEquals("current", current.get("status").asText());
        var past = send(post(path), input(null, "2026-11-04"), 201);
        assertEquals("past", past.get("status").asText());
        var future = send(post(path), input("2026-11-06", null), 201);
        assertEquals("upcoming", future.get("status").asText());
        var open = send(post(path), input(null, null), 201);
        assertEquals("current", open.get("status").asText());
        mvc.perform(get(path).param("period", "current")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get(path).param("period", "past")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(path).param("period", "upcoming")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(path).param("size", "1")).andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get(path).param("q", "BM fittizio")).andExpect(jsonPath("$.totalElements").value(4));
        var update = input(null, null);
        update.put("version", current.get("version").asText());
        update.put("client", "Cliente aggiornato");
        var changed = send(put("/api/v1/projects/" + current.get("id").asText()), update, 200);
        assertEquals("Cliente aggiornato", changed.get("client").asText());
        assertEquals(person, changed.get("personId").asText());
        send(put("/api/v1/projects/" + current.get("id").asText()), update, 409);
        String projectPath = "/api/v1/projects/" + changed.get("id").asText();
        var archived = send(post(projectPath + "/archive"), Map.of("version", changed.get("version").asText()), 200);
        assertEquals("archived", archived.get("status").asText());
        mvc.perform(get(projectPath)).andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").value("Note fittizie"));
        mvc.perform(get(path)).andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get(path).param("includeArchived", "true")).andExpect(jsonPath("$.totalElements").value(4));
        mvc.perform(get("/api/v1/people/" + person + "/export")).andExpect(status().isOk())
                .andExpect(jsonPath("$.projects.length()").value(4))
                .andExpect(jsonPath("$.projects[0].client").value("Cliente aggiornato"));
        String csv = mvc.perform(get("/api/v1/people/" + person + "/export").param("format", "csv"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(csv.contains("\"project\""));
        assertTrue(csv.contains("\"Cliente aggiornato\""));
        assertTrue(csv.contains("\"businessManager\""));
        update.put("version", archived.get("version").asText());
        send(put(projectPath), update, 409);
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> jdbc.update("DELETE FROM project WHERE id = ?", changed.get("id").asText()));
    }

    @Test
    void validationSecurityAndParentIsolationAreEnforced() throws Exception {
        String person = person();
        String path = "/api/v1/people/" + person + "/projects";
        send(post(path), input("2026-11-06", "2026-11-05"), 400);
        var invalid = input(null, null);
        invalid.put("workMode", "invalid");
        send(post(path), invalid, 400);
        invalid = input(null, null);
        invalid.put("client", " ");
        send(post(path), invalid, 400);
        invalid = input(null, null);
        invalid.put("startsOn", "0001-01-01");
        send(post(path), invalid, 400);
        mvc.perform(get(path).param("period", "invalid")).andExpect(status().isBadRequest());
        mvc.perform(get(path).param("sort", "notes,asc")).andExpect(status().isBadRequest());
        mvc.perform(get(path).param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(input(null, null)))).andExpect(status().isForbidden());
        String otherPerson = person();
        var project = send(post(path), input(null, null), 201);
        mvc.perform(get("/api/v1/people/" + otherPerson + "/projects"))
                .andExpect(jsonPath("$.totalElements").value(0));
        String projectPath = "/api/v1/projects/" + project.get("id").asText();
        var transfer = input(null, null);
        transfer.put("personId", otherPerson);
        transfer.put("version", project.get("version").asText());
        send(put(projectPath), transfer, 400);
        var owner = mvc.perform(get("/api/v1/people/" + person)).andReturn().getResponse();
        String version = json.readTree(owner.getContentAsString()).get("version").asText();
        send(post("/api/v1/people/" + person + "/archive"), Map.of("version", version), 200);
        send(post(path), input(null, null), 409);
        var update = input(null, null);
        update.put("version", project.get("version").asText());
        send(put(projectPath), update, 409);
    }

    @Test
    @WithAnonymousUser
    void anonymousProjectReadsAreRejected() throws Exception {
        mvc.perform(get("/api/v1/people/1/projects")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/projects/1")).andExpect(status().isUnauthorized());
    }

    private Map<String, Object> input(String starts, String ends) {
        var input = new HashMap<String, Object>();
        input.put("client", "Cliente fittizio");
        input.put("startsOn", starts);
        input.put("endsOn", ends);
        input.put("businessManager", "BM fittizio");
        input.put("workMode", "hybrid");
        input.put("notes", "Note fittizie");
        return input;
    }

    private JsonNode send(MockHttpServletRequestBuilder request, Object input, int status) throws Exception {
        String body = mvc.perform(request.with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(input))).andExpect(status().is(status))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }
}
