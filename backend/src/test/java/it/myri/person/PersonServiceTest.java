package it.myri.person;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import it.myri.auth.*;
import it.myri.common.ApiException;
import java.time.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class PersonServiceTest {
    private final PersonRepository repository = mock(PersonRepository.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final PersonService service = new PersonService(repository, users, Clock.systemUTC(), ZoneId.of("UTC"));

    @Test
    void managerGraphIsLockedBeforeRejectingCycle() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        Person a = person(1L);
        Person b = person(2L);
        b.managerId = a.id;
        when(repository.findById(1L)).thenReturn(Optional.of(a));
        when(repository.findById(2L)).thenReturn(Optional.of(b));
        assertThrows(ApiException.class, () -> service.update(1L, input(2L, 0L)));
        var order = inOrder(users, repository);
        order.verify(users).lockSingleton();
        order.verify(repository).findById(1L);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void outdatedVersionNeverChangesRecord() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.findById(1L)).thenReturn(Optional.of(person(1L)));
        assertThrows(ApiException.class, () -> service.update(1L, input(null, 9L)));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void seniorityUsesCompletedYearsAndMonthsInApplicationTimezone() {
        var localDayBoundary = Clock.fixed(Instant.parse("2026-11-04T23:30:00Z"), ZoneOffset.UTC);
        var personService = new PersonService(repository, users, localDayBoundary, ZoneId.of("Europe/Rome"));
        Person person = person(3L);
        person.hiredOn = LocalDate.of(2020, 11, 5);
        person.careerStartedOn = LocalDate.of(2017, 11, 5);
        person.seniorityLevel = "medior";
        person.mypadId = "fictitious-123";
        person.frameworks = List.of("Java", "Spring Boot");
        assertEquals("6 anni e 0 mesi", personService.view(person).seniority());
        assertEquals("9 anni e 0 mesi", personService.view(person).careerDuration());
        assertEquals("medior", personService.view(person).seniorityLevel());
        assertEquals("fictitious-123", personService.view(person).mypadId());
        assertEquals(List.of("Java", "Spring Boot"), personService.view(person).frameworks());
    }

    @Test
    void frameworksAreTrimmedAndDuplicatesAreRejected() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.existsByMypadId("test-fictitious")).thenReturn(false);
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var input = new PersonDtos.Input("Fictitious", "Example", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, null, null, null, "active", null,
                null, null, "test-fictitious", List.of(" Java ", "Spring Boot"));
        var saved = service.create(input);
        assertEquals(List.of("Java", "Spring Boot"), saved.frameworks());

        var duplicate = new PersonDtos.Input("Fictitious", "Example", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, null, null, null, "active", null,
                null, null, "test-fictitious", List.of("Java", " java "));
        assertThrows(ApiException.class, () -> service.create(duplicate));
        verify(repository, times(1)).saveAndFlush(any());
    }

    @Test
    void elapsedTimeUsesCompletedMonthsAndHandlesLeapDayAndFutureDates() {
        Person person = person(3L);
        person.hiredOn = LocalDate.of(2024, 2, 29);
        person.careerStartedOn = LocalDate.of(2020, 1, 31);
        var view = PersonMapper.view(person, LocalDate.of(2025, 2, 28));
        assertEquals("0 anni e 11 mesi", view.seniority());
        assertEquals("5 anni e 0 mesi", view.careerDuration());
        assertEquals("data futura", PersonMapper.view(person, LocalDate.of(2019, 1, 1)).careerDuration());
        person.careerStartedOn = null;
        assertNull(PersonMapper.view(person, LocalDate.of(2025, 2, 28)).careerDuration());
    }

    @Test
    void newPersonRequiresMypadIdAndRejectsDuplicateBeforeSaving() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        var valid = input(null, null);
        var missing = new PersonDtos.Input(valid.firstName(), valid.lastName(), null, null, null,
                valid.hiredOn(), null, null, null, null, null, "active", null, null, null, null, null);
        assertThrows(ApiException.class, () -> service.create(missing));
        when(repository.existsByMypadId(valid.mypadId())).thenReturn(true);
        var duplicate = assertThrows(ApiException.class, () -> service.create(valid));
        assertEquals(org.springframework.http.HttpStatus.CONFLICT, duplicate.status);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void careerCannotStartAfterHiringAndLegacyFieldsRemainUnknown() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        var invalid = new PersonDtos.Input("Fictitious", "Example", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, null, null, null, "active", null,
                LocalDate.of(2021, 1, 1), "junior", "fictitious-id", null);
        assertThrows(ApiException.class, () -> service.create(invalid));
        verify(repository, never()).saveAndFlush(any());
        Person person = person(1L);
        person.hiredOn = LocalDate.of(2020, 1, 1);
        var view = PersonMapper.view(person, LocalDate.of(2026, 11, 4));
        assertNull(view.careerStartedOn());
        assertNull(view.seniorityLevel());
        assertNull(view.mypadId());
    }

    private static Person person(Long id) {
        Person p = new Person();
        p.id = id;
        p.version = 0L;
        return p;
    }

    private static PersonDtos.Input input(Long manager, Long version) {
        return new PersonDtos.Input("Fictitious", "Example", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, manager, null, null, "active", version,
                LocalDate.of(2018, 1, 1), "medior", "test-fictitious", null);
    }
}
