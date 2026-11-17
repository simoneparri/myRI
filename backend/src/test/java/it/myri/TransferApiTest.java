package it.myri;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import it.myri.auth.*;
import it.myri.export.*;
import java.sql.Statement;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class TransferApiTest extends IntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransferService transfers;
    @Autowired PersonExportService exports;
    @Autowired AppUserRepository users;

    private RequestPostProcessor owner() {
        var actor = new AccountPrincipal(users.findBySingletonKey((byte) 1).orElseThrow());
        actor.eraseCredentials();
        return user(actor);
    }

    private long insert(String sql, Object... args) {
        var key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
            return statement;
        }, key);
        return Objects.requireNonNull(key.getKey()).longValue();
    }

    private long person() {
        String code = UUID.randomUUID().toString();
        return insert("""
                INSERT INTO person(first_name,last_name,hired_on,status,mypad_id,rsno_agresso,inside_id)
                VALUES('Persona','Fittizia','2020-01-01','active',?,?,?)
                """, "pad-" + code, "rsno-" + code, "inside-" + code);
    }

    private long fullPerson() {
        long p = person();
        jdbc.update("UPDATE person SET frameworks=JSON_ARRAY('Java','Spring Boot'),capacity_management='Fittizio' WHERE id=?", p);
        insert("INSERT INTO contact(person_id,type,value,archived_at) VALUES(?,'chat','Fittizio','2026-01-01')", p);
        insert("""
                INSERT INTO project(person_id,client,work_mode,created_at,updated_at)
                VALUES(?,'Cliente fittizio','hybrid',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))
                """, p);
        long base = insert("""
                INSERT INTO salary(person_id,amount,currency,effective_on,reason,meal_vouchers,bonus_letter_amount,company_car)
                VALUES(?,40000.12,'EUR','2025-01-01','Fittizio',1,0,0)
                """, p);
        long raise = insert("""
                INSERT INTO raise_request(person_id,base_salary_id,currency,requested_on,requested_salary,
                motivation,status,outcome_on,benefits_specified,meal_vouchers,bonus_letter_amount,company_car)
                VALUES(?,?,'EUR','2026-01-01',44000.12,'Fittizio','approved','2026-02-01',1,0,0,1)
                """, p, base);
        insert("""
                INSERT INTO salary(person_id,amount,currency,effective_on,reason,source_raise_request_id,
                meal_vouchers,bonus_letter_amount,company_car)
                VALUES(?,44000.12,'EUR','2026-03-01','Fittizio',?,0,0,1)
                """, p, raise);
        long talk = insert("INSERT INTO career_talk(person_id,held_at,topics) VALUES(?,'2026-01-01','Fittizio')", p);
        long root = insert("""
                INSERT INTO task(person_id,career_talk_id,raise_request_id,title,due_at,priority,status,
                recurrence_frequency,recurrence_interval,completed_at)
                VALUES(?,?,?,'Fittizio','2026-01-01','high','done','monthly',1,'2026-01-02')
                """, p, talk, raise);
        insert("""
                INSERT INTO task(person_id,title,due_at,priority,status,source_task_id,
                recurrence_frequency,recurrence_interval)
                VALUES(?,'Prossimo fittizio','2026-02-01','high','todo',?,'monthly',1)
                """, p, root);
        return p;
    }

    private ObjectNode bundle(long... people) {
        return json.valueToTree(transfers.export(Arrays.stream(people).boxed().toList()));
    }

    private ObjectNode newIdentity(ObjectNode bundle, int index) {
        ObjectNode p = (ObjectNode) bundle.path("people").get(index).path("data").path("person");
        String code = UUID.randomUUID().toString();
        p.put("mypadId", "pad-" + code);
        p.put("rsnoAgresso", "rsno-" + code);
        p.put("insideId", "inside-" + code);
        return p;
    }

    private ObjectNode importOk(ObjectNode bundle) throws Exception {
        return (ObjectNode) json.readTree(mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                        .contentType("application/json").content(json.writeValueAsBytes(bundle)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsByteArray());
    }

    @Test
    void roundTripRemapsEveryLinkPreservesHistoryBenefitsAndAddsLocalAudit() throws Exception {
        long original = fullPerson();
        ObjectNode file = bundle(original);
        newIdentity(file, 0);
        var report = importOk(file);
        assertEquals(1, report.path("imported").intValue());
        long copyId = report.path("results").get(0).path("personId").asLong();
        assertNotEquals(original, copyId);
        var source = exports.snapshot(original);
        var copy = exports.snapshot(copyId);
        assertEquals(source.person().createdAt(), copy.person().createdAt());
        assertEquals(source.person().frameworks(), copy.person().frameworks());
        assertEquals("Fittizio", copy.person().capacityManagement());
        assertTrue(copy.person().version() >= 0);
        assertEquals(1, copy.contacts().size());
        assertEquals(source.contacts().getFirst().archivedAt(), copy.contacts().getFirst().archivedAt());
        assertEquals(1, copy.projects().size());
        assertEquals(1, copy.careerTalks().size());
        assertEquals(2, copy.salaries().size());
        assertEquals(1, copy.raiseRequests().size());
        assertEquals(2, copy.tasks().size());
        var raise = copy.raiseRequests().getFirst();
        var generated = copy.salaries().stream().filter(s -> s.sourceRaiseRequestId() != null).findFirst().orElseThrow();
        assertEquals(raise.id(), generated.sourceRaiseRequestId());
        assertEquals(generated.id(), raise.salaryId());
        assertEquals(copy.salaries().getFirst().id(), raise.baseSalaryId());
        assertEquals("44000.12", generated.amount().toPlainString());
        assertFalse(generated.mealVouchers());
        assertEquals(0, generated.bonusLetterAmount().signum());
        assertTrue(generated.companyCar());
        assertEquals(copy.tasks().getFirst().id(), copy.tasks().getLast().sourceTaskId());
        assertEquals(copy.careerTalks().getFirst().id(), copy.tasks().getFirst().careerTalkId());
        assertEquals(raise.id(), copy.tasks().getFirst().raiseRequestId());
        assertEquals(3, count("audit_event", copyId));
        assertEquals(0, count("notification", copyId));
        assertEquals(1, importOk(file).path("skipped").intValue());
        assertEquals(3, count("audit_event", copyId));
        // The production append-only trigger is still installed.
        assertThrows(org.springframework.dao.DataAccessException.class,
                () -> jdbc.update("UPDATE salary SET amount=1 WHERE id=?", generated.id()));
    }

    @Test
    void skipsEitherIdentifierIncludingArchivedPeopleAndContinuesWithoutImportingChildren() throws Exception {
        long first = fullPerson(), second = fullPerson(), third = person();
        jdbc.update("UPDATE person SET archived_at=UTC_TIMESTAMP(6) WHERE id=?", first);
        ObjectNode file = bundle(first, second, third);
        ObjectNode a = (ObjectNode) file.path("people").get(0).path("data").path("person");
        a.put("mypadId", UUID.randomUUID().toString()); // match RSNO only
        ((ObjectNode) file.path("people").get(0).path("data").path("contacts").get(0)).putNull("type");
        ObjectNode b = (ObjectNode) file.path("people").get(1).path("data").path("person");
        b.put("rsnoAgresso", UUID.randomUUID().toString()); // match MyPad only
        newIdentity(file, 2);
        int contactsBefore = jdbc.queryForObject("SELECT COUNT(*) FROM contact", Integer.class);
        var report = importOk(file);
        assertEquals(1, report.path("imported").intValue());
        assertEquals(2, report.path("skipped").intValue());
        assertEquals("rsno_agresso", report.path("results").get(0).path("reason").asText());
        assertEquals("mypad_id", report.path("results").get(1).path("reason").asText());
        assertEquals(contactsBefore, jdbc.queryForObject("SELECT COUNT(*) FROM contact", Integer.class));
    }

    @Test
    void sameFileDuplicatesAreSkippedAndNullLegacyIdentifiersDoNotMatch() throws Exception {
        long first = person(), second = person();
        ObjectNode file = bundle(first, second);
        ObjectNode a = newIdentity(file, 0), b = newIdentity(file, 1);
        b.put("mypadId", a.path("mypadId").asText());
        var report = importOk(file);
        assertEquals(1, report.path("imported").intValue());
        assertEquals(1, report.path("skipped").intValue());
        file = bundle(first);
        a = newIdentity(file, 0);
        a.putNull("mypadId");
        a.putNull("rsnoAgresso");
        a.putNull("insideId");
        assertEquals(1, importOk(file).path("imported").intValue());
    }

    @Test
    void invalidReferencesRollbackWholeFileIncludingPreviouslyImportedPersonAndAudit() throws Exception {
        long first = fullPerson(), second = fullPerson();
        ObjectNode file = bundle(first, second);
        ObjectNode a = newIdentity(file, 0);
        newIdentity(file, 1);
        ObjectNode task = (ObjectNode) file.path("people").get(1).path("data").path("tasks").get(0);
        task.put("careerTalkId", "9223372036854775807");
        mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                        .contentType("application/json").content(json.writeValueAsBytes(file)))
                .andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM person WHERE mypad_id=?",
                Integer.class, a.path("mypadId").asText()));
    }

    @Test
    void managersAreRemappedOrConvertedToExternalTextAndCyclesAreRejected() throws Exception {
        long manager = person(), employee = person();
        jdbc.update("UPDATE person SET manager_id=? WHERE id=?", manager, employee);
        ObjectNode file = bundle(employee, manager);
        newIdentity(file, 0);
        newIdentity(file, 1);
        var report = importOk(file);
        long employeeCopy = report.path("results").get(0).path("personId").asLong();
        long managerCopy = report.path("results").get(1).path("personId").asLong();
        assertEquals(managerCopy, exports.snapshot(employeeCopy).person().managerId());
        file = bundle(employee);
        newIdentity(file, 0);
        employeeCopy = importOk(file).path("results").get(0).path("personId").asLong();
        var external = exports.snapshot(employeeCopy).person();
        assertNull(external.managerId());
        assertEquals("Fittizia Persona", external.externalManager());
        file = bundle(employee, manager);
        newIdentity(file, 0);
        ObjectNode managerData = newIdentity(file, 1);
        managerData.put("managerId", Long.toString(employee));
        mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                        .contentType("application/json").content(json.writeValueAsBytes(file)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMalformedVersionsUnknownFieldsEmptySelectionsAndRequiresAuthenticationAndCsrf() throws Exception {
        mvc.perform(post("/api/v1/transfers/export").with(csrf()).contentType("application/json").content("{\"personIds\":[\"1\"]}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/transfers/import").with(csrf()).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/transfers/import").with(owner()).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        for (String file : List.of("null", "{}", "{\"format\":\"myri-transfer\",\"schemaVersion\":2,\"people\":[]}",
                "{\"unknown\":true}", "{} {}")) {
            mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                            .contentType("application/json").content(file))
                    .andExpect(status().isBadRequest());
        }

        mvc.perform(post("/api/v1/transfers/export").with(owner()).with(csrf())
                        .contentType("application/json").content("{\"personIds\":[]}"))
                .andExpect(status().isBadRequest());
        long p = person();
        mvc.perform(post("/api/v1/transfers/export").with(owner()).with(csrf())
                        .contentType("application/json").content("{\"personIds\":[\"" + p + "\"]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.format").value("myri-transfer"))
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                        .contentType("application/json").content(new byte[TransferDtos.MAX_BYTES + 1]))
                .andExpect(status().isBadRequest());
    }

    @Test
    void concurrentImportsOfTheSameFileCreateOneAggregateAndSkipTheOther() throws Exception {
        ObjectNode file = bundle(fullPerson());
        newIdentity(file, 0);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            Callable<ObjectNode> operation = () -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                return importOk(file);
            };
            var first = pool.submit(operation);
            var second = pool.submit(operation);
            start.countDown();
            var a = first.get(20, TimeUnit.SECONDS);
            var b = second.get(20, TimeUnit.SECONDS);
            assertEquals(1, a.path("imported").asInt() + b.path("imported").asInt());
            assertEquals(1, a.path("skipped").asInt() + b.path("skipped").asInt());
        }
    }

    @Test
    void incoherentFinancialGraphsTaskCyclesAndInvalidValuesAreRejectedWithoutPartialData() throws Exception {
        long source = fullPerson();
        List<Consumer<ObjectNode>> corruptions = List.of(
                data -> ((ObjectNode) data.path("salaries").get(0)).put("currency", "ZZZ"),
                data -> ((ObjectNode) data.path("salaries").get(1)).put("amount", "0.00"),
                data -> ((ObjectNode) data.path("raiseRequests").get(0))
                        .put("baseSalaryId", data.path("salaries").get(1).path("id").asText()),
                data -> ((ObjectNode) data.path("tasks").get(0))
                        .put("sourceTaskId", data.path("tasks").get(1).path("id").asText()),
                data -> ((ObjectNode) data.path("projects").get(0)).put("startsOn", "2026-03-01").put("endsOn", "2026-02-01"),
                data -> ((ObjectNode) data.path("person")).put("bornOn", "9999-12-31"),
                data -> ((ObjectNode) data.path("contacts").get(0)).put("personId", "-1")
        );
        for (var corrupt : corruptions) {
            ObjectNode file = bundle(source);
            ObjectNode p = newIdentity(file, 0);
            corrupt.accept((ObjectNode) file.path("people").get(0).path("data"));
            mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                            .contentType("application/json").content(json.writeValueAsBytes(file)))
                    .andExpect(status().isBadRequest());
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM person WHERE mypad_id=?",
                    Integer.class, p.path("mypadId").asText()));
        }
    }

    @Test
    void insideIdConflictIsNotSilentlySkippedAndRollsBackEarlierPeople() throws Exception {
        long first = person(), second = person();
        ObjectNode file = bundle(first, second);
        ObjectNode p = newIdentity(file, 0);
        ObjectNode secondData = (ObjectNode) file.path("people").get(1).path("data").path("person");
        String conflictingInside = secondData.path("insideId").asText();
        newIdentity(file, 1).put("insideId", conflictingInside);
        mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                        .contentType("application/json").content(json.writeValueAsBytes(file)))
                .andExpect(status().isConflict());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM person WHERE mypad_id=?",
                Integer.class, p.path("mypadId").asText()));
    }

    @Test
    void enforcesPersonAndTotalRecordLimitsBeforeImporting() throws Exception {
        long p = person();
        var overSelection = json.createObjectNode();
        var ids = overSelection.putArray("personIds");
        for (int i = 0; i <= TransferDtos.MAX_PEOPLE; i++) ids.add(Long.toString(p));
        mvc.perform(post("/api/v1/transfers/export").with(owner()).with(csrf())
                        .contentType("application/json").content(json.writeValueAsBytes(overSelection)))
                .andExpect(status().isBadRequest());
        ObjectNode file = bundle(p);
        ObjectNode template = ((ObjectNode) file.path("people").get(0)).deepCopy();
        var entries = file.withArray("people");
        for (int i = 1; i <= TransferDtos.MAX_PEOPLE; i++) entries.add(template);
        mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                        .contentType("application/json").content(json.writeValueAsBytes(file)))
                .andExpect(status().isBadRequest());
        file = bundle(p);
        var contacts = ((ObjectNode) file.path("people").get(0).path("data")).withArray("contacts");
        for (int i = 0; i < TransferDtos.MAX_RECORDS; i++) contacts.addNull();
        mvc.perform(post("/api/v1/transfers/import").with(owner()).with(csrf())
                        .contentType("application/json").content(json.writeValueAsBytes(file)))
                .andExpect(status().isBadRequest());
    }

    private int count(String table, long personId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE person_id=?", Integer.class, personId);
    }
}
