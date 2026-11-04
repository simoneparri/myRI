package it.myri;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doThrow;

import it.myri.audit.AuditService;
import it.myri.auth.*;
import it.myri.common.ApiException;
import it.myri.person.*;
import it.myri.raiserequest.*;
import it.myri.salary.*;
import it.myri.task.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

class FinancialAtomicityTest extends IntegrationTest {
    @Autowired PersonService people;
    @Autowired SalaryService salaries;
    @Autowired RaiseService raises;
    @Autowired TaskService tasks;
    @Autowired AppUserRepository users;
    @Autowired JdbcTemplate jdbc;
    @MockitoSpyBean AuditService audit;

    @Test
    void failingAuditRollsBackApprovalSalaryAndAllAuditChanges() {
        asOwner(() -> {
            var request = submitted();
            long before = jdbc.queryForObject("SELECT COUNT(*) FROM audit_event WHERE person_id = ?",
                    Long.class, request.personId());
            AuditService target = org.springframework.test.util.AopTestUtils.getUltimateTargetObject(audit);
            doThrow(ApiException.conflict("Simulated audit failure")).when(target)
                    .record(eq(request.personId()), anyLong(), isNull(), eq("salary_created"), anyString());
            assertThrows(ApiException.class, () -> raises.approve(request.id(), outcome(request)));
            assertEquals("submitted", raises.detail(request.id()).status());
            assertNull(raises.detail(request.id()).salaryId());
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM salary WHERE person_id = ?",
                    Long.class, request.personId()));
            assertEquals(before, jdbc.queryForObject("SELECT COUNT(*) FROM audit_event WHERE person_id = ?",
                    Long.class, request.personId()));
            return null;
        });
    }

    @Test
    void concurrentApprovalsProduceOneSalaryAndOneOutcome() throws Exception {
        var request = asOwner(this::submitted);
        var outcomes = parallel(() -> asOwner(() -> raises.approve(request.id(), outcome(request))));
        assertEquals(outcomes.get(0).salaryId(), outcomes.get(1).salaryId());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM salary WHERE source_raise_request_id = ?",
                Long.class, request.id()));
        assertEquals("Tempo indeterminato", jdbc.queryForObject(
                "SELECT contract_type FROM salary WHERE source_raise_request_id = ?", String.class, request.id()));
        assertEquals(new BigDecimal("40.00"), jdbc.queryForObject(
                "SELECT weekly_hours FROM salary WHERE source_raise_request_id = ?", BigDecimal.class, request.id()));
        assertEquals("Livello fittizio", jdbc.queryForObject(
                "SELECT classification_level FROM salary WHERE source_raise_request_id = ?", String.class, request.id()));
        assertEquals(3, jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_event WHERE raise_request_id = ?", Long.class, request.id()));
    }

    @Test
    void concurrentManualSalaryRetriesUseOneRecord() throws Exception {
        var person = asOwner(this::person);
        var input = new SalaryDtos.Input(new BigDecimal("50000"), "EUR",
                LocalDate.of(2025, 1, 1), "Tempo indeterminato", new BigDecimal("40.00"),
                "Livello fittizio", "Fictitious", UUID.randomUUID().toString());
        var results = parallel(() -> asOwner(() -> salaries.create(person.id(), input)));
        assertEquals(results.get(0).id(), results.get(1).id());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM salary WHERE person_id = ?", Long.class, person.id()));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM audit_event WHERE person_id = ?", Long.class, person.id()));
    }

    @Test
    void concurrentCensusesWithTheSameMypadIdCreateOnlyOnePerson() throws Exception {
        String mypadId = UUID.randomUUID().toString();
        var input = new PersonDtos.Input("Fictitious", "Concurrent census", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, null, null, null, "active", null,
                LocalDate.of(2018, 1, 1), "medior", mypadId);
        var outcomes = parallel(() -> asOwner(() -> {
            try {
                people.create(input);
                return true;
            } catch (ApiException exception) {
                assertEquals(org.springframework.http.HttpStatus.CONFLICT, exception.status);
                return false;
            }
        }));
        assertNotEquals(outcomes.get(0), outcomes.get(1));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM person WHERE mypad_id = ?", Integer.class, mypadId));
    }

    @Test
    void concurrentManagerChangesCannotCreateCycle() throws Exception {
        var a = asOwner(this::person);
        var b = asOwner(this::person);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var first = pool.submit(() -> {
                start.await();
                return asOwner(() -> updateManager(a, b.id()));
            });
            var second = pool.submit(() -> {
                start.await();
                return asOwner(() -> updateManager(b, a.id()));
            });
            start.countDown();
            assertNotEquals(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
        }
    }

    @Test
    void concurrentTaskCompletionProducesOneSuccessor() throws Exception {
        var task = asOwner(() -> tasks.create(new TaskDtos.Input("Fictitious recurring task", null,
                Instant.parse("2026-01-31T09:00:00Z"), "medium", "todo", null, null, null,
                "monthly", 1, null)));
        var results = parallel(() -> asOwner(() -> tasks.complete(task.id(), task.version())));
        assertEquals(results.get(0).nextOccurrence().id(), results.get(1).nextOccurrence().id());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM task WHERE source_task_id = ?", Long.class, task.id()));
    }

    private boolean updateManager(PersonDtos.View person, Long manager) {
        try {
            people.update(person.id(), new PersonDtos.Input(person.firstName(), person.lastName(), null,
                    null, null, person.hiredOn(), null, null, manager, null, null, "active", person.version(),
                    person.careerStartedOn(), person.seniorityLevel(), person.mypadId()));
            return true;
        } catch (ApiException exception) {
            assertEquals(org.springframework.http.HttpStatus.CONFLICT, exception.status);
            return false;
        }
    }

    private RaiseDtos.View submitted() {
        var person = person();
        var salary = salaries.create(person.id(), new SalaryDtos.Input(new BigDecimal("50000.00"),
                "EUR", LocalDate.of(2025, 1, 1), "Tempo indeterminato", new BigDecimal("40.00"),
                "Livello fittizio", "Fictitious", UUID.randomUUID().toString()));
        var request = raises.create(new RaiseDtos.Input(person.id(), salary.id(), LocalDate.of(2026, 1, 1),
                new BigDecimal("55000.00"), new BigDecimal("10.0000"), "Fictitious", null));
        return raises.submit(request.id(), request.version());
    }

    private RaiseDtos.Outcome outcome(RaiseDtos.View request) {
        return new RaiseDtos.Outcome(request.version(), LocalDate.of(2026, 2, 1), "Fictitious",
                true, LocalDate.of(2026, 3, 1));
    }

    private PersonDtos.View person() {
        return people.create(new PersonDtos.Input("Fictitious", UUID.randomUUID().toString(), null, null,
                null, LocalDate.of(2020, 1, 1), null, null, null, null, null, "active", null,
                null, null, UUID.randomUUID().toString()));
    }

    private <T> T asOwner(Supplier<T> operation) {
        AccountPrincipal actor = new AccountPrincipal(users.findBySingletonKey((byte) 1).orElseThrow());
        actor.eraseCredentials();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(actor, null, actor.getAuthorities()));
        SecurityContextHolder.setContext(context);
        try {
            return operation.get();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private <T> List<T> parallel(Callable<T> operation) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            Callable<T> waiting = () -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                return operation.call();
            };
            var first = pool.submit(waiting);
            var second = pool.submit(waiting);
            start.countDown();
            return List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
        }
    }
}
