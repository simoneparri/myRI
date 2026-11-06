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
    void ageUsesCompletedYearsAndTheApplicationCalendarIncludingLeapBirthdays() {
        var clock = Clock.fixed(Instant.parse("2026-11-04T23:30:00Z"), ZoneOffset.UTC);
        var localService = new PersonService(repository, users, clock, ZoneId.of("Europe/Rome"));
        Person person = person(1L);
        assertNull(localService.view(person).age());
        person.bornOn = LocalDate.of(1990, 11, 5);
        assertEquals(36, localService.view(person).age());
        assertEquals(35, PersonMapper.view(person, LocalDate.of(2026, 11, 4)).age());
        person.bornOn = LocalDate.of(2000, 2, 29);
        assertEquals(24, PersonMapper.view(person, LocalDate.of(2025, 2, 28)).age());
        assertEquals(25, PersonMapper.view(person, LocalDate.of(2025, 3, 1)).age());
        person.bornOn = LocalDate.of(2026, 11, 5);
        assertEquals(0, localService.view(person).age());
    }

    @Test
    void birthDateIsRequiredAtCensusAndValidatedAgainstTheLocalDay() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var clock = Clock.fixed(Instant.parse("2026-11-04T23:30:00Z"), ZoneOffset.UTC);
        var localService = new PersonService(repository, users, clock, ZoneId.of("Europe/Rome"));
        for (LocalDate invalid : new LocalDate[] { null, LocalDate.of(999, 1, 1), LocalDate.of(2026, 11, 6) }) {
            assertThrows(ApiException.class, () -> localService.create(birthInput(invalid, null)));
        }
        verify(repository, never()).saveAndFlush(any());
        assertEquals(0, localService.create(birthInput(LocalDate.of(2026, 11, 5), null)).age());
    }

    @Test
    void legacyBirthDateCanRemainUnknownButCannotBeClearedOnceAssigned() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        Person person = person(1L);
        when(repository.findById(1L)).thenReturn(Optional.of(person));
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertNull(service.update(1L, birthInput(null, 0L)).age());
        LocalDate date = LocalDate.of(1990, 1, 1);
        assertEquals(date, service.update(1L, birthInput(date, 0L)).bornOn());
        assertThrows(ApiException.class, () -> service.update(1L, birthInput(null, 0L)));
        assertEquals(date, person.bornOn);
    }

    private static PersonDtos.Input birthInput(LocalDate date, Long version) {
        var valid = input(null, version);
        return new PersonDtos.Input(valid.firstName(), valid.lastName(), null, null, null,
                valid.hiredOn(), null, null, null, null, null, "active", version,
                valid.careerStartedOn(), valid.seniorityLevel(), valid.mypadId(), null, date,
                valid.rsnoAgresso(), valid.insideId(), valid.education(), null);
    }

    @Test
    void frameworksAreTrimmedAndDuplicatesAreRejected() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.existsByMypadId("test-fictitious")).thenReturn(false);
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var input = new PersonDtos.Input("Fictitious", "Example", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, null, null, null, "active", null,
                null, null, "test-fictitious", List.of(" Java ", "Spring Boot"), LocalDate.of(1990, 1, 1),
                "00001", "00002", "master", null);
        var saved = service.create(input);
        assertEquals(List.of("Java", "Spring Boot"), saved.frameworks());

        var duplicate = new PersonDtos.Input("Fictitious", "Example", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, null, null, null, "active", null,
                null, null, "test-fictitious", List.of("Java", " java "), LocalDate.of(1990, 1, 1),
                "00001", "00002", "master", null);
        assertThrows(ApiException.class, () -> service.create(duplicate));
        verify(repository, times(1)).saveAndFlush(any());
    }

    @Test
    void capacityManagementIsStoredAndExposed() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var input = new PersonDtos.Input("Fictitious", "Example", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, null, null, null, "active", null,
                null, null, "test-fictitious", null, LocalDate.of(1990, 1, 1),
                "00001", "00002", "master", "Allocazione fittizia al 50%");
        assertEquals("Allocazione fittizia al 50%", service.create(input).capacityManagement());
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
                valid.hiredOn(), null, null, null, null, null, "active", null, null, null, null, null, valid.bornOn(),
                valid.rsnoAgresso(), valid.insideId(), valid.education(), null);
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
                LocalDate.of(2021, 1, 1), "junior", "fictitious-id", null, LocalDate.of(1990, 1, 1),
                "00001", "00002", "master", null);
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

    @Test
    void metadataIsRequiredForCreationAndCodesPreserveLeadingZerosAfterTrimming() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertThrows(ApiException.class, () -> service.create(metadata(null, "0012", "diploma", null)));
        assertThrows(ApiException.class, () -> service.create(metadata("0011", null, "diploma", null)));
        assertThrows(ApiException.class, () -> service.create(metadata("0011", "0012", null, null)));
        for (String invalid : List.of("", " ", "a\nb", "x".repeat(101))) {
            assertThrows(ApiException.class, () -> service.create(metadata(invalid, "0012", "diploma", null)));
            assertThrows(ApiException.class, () -> service.create(metadata("0011", invalid, "diploma", null)));
        }
        assertThrows(ApiException.class, () -> service.create(metadata("0011", "0012", "other", null)));
        verify(repository, never()).saveAndFlush(any());
        var saved = service.create(metadata(" 0011 ", " 0012 ", "bachelor", null));
        assertEquals("0011", saved.rsnoAgresso());
        assertEquals("0012", saved.insideId());
        assertEquals("bachelor", saved.education());
    }

    @Test
    void duplicateMetadataIsRejectedForCreationAndUpdate() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.existsByRsnoAgresso("0011")).thenReturn(true);
        assertEquals(org.springframework.http.HttpStatus.CONFLICT,
                assertThrows(ApiException.class, () -> service.create(metadata("0011", "0012", "phd", null))).status);
        when(repository.existsByRsnoAgresso("0011")).thenReturn(false);
        when(repository.existsByInsideId("0012")).thenReturn(true);
        assertEquals(org.springframework.http.HttpStatus.CONFLICT,
                assertThrows(ApiException.class, () -> service.create(metadata("0011", "0012", "phd", null))).status);
        when(repository.findById(1L)).thenReturn(Optional.of(person(1L)));
        when(repository.existsByRsnoAgressoAndIdNot("0011", 1L)).thenReturn(true);
        assertThrows(ApiException.class, () -> service.update(1L, metadata("0011", "0012", "master", 0L)));
        when(repository.existsByRsnoAgressoAndIdNot("0011", 1L)).thenReturn(false);
        when(repository.existsByInsideIdAndIdNot("0012", 1L)).thenReturn(true);
        assertThrows(ApiException.class, () -> service.update(1L, metadata("0011", "0012", "master", 0L)));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void legacyMetadataRemainsUnknownUntilAssignedAndCannotThenBeCleared() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.findById(1L)).thenReturn(Optional.of(person(1L)));
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var legacy = service.update(1L, metadata(null, null, null, 0L));
        assertNull(legacy.rsnoAgresso());
        assertNull(legacy.insideId());
        assertNull(legacy.education());
        service.update(1L, metadata("0011", "0012", "master", 0L));
        assertThrows(ApiException.class, () -> service.update(1L, metadata(null, "0012", "master", 0L)));
        assertThrows(ApiException.class, () -> service.update(1L, metadata("0011", null, "master", 0L)));
        assertThrows(ApiException.class, () -> service.update(1L, metadata("0011", "0012", null, 0L)));
        assertEquals("phd", service.update(1L, metadata("0013", "0014", "phd", 0L)).education());
    }

    private static PersonDtos.Input metadata(String rsno, String inside, String education, Long version) {
        var valid = input(null, version);
        return new PersonDtos.Input(valid.firstName(), valid.lastName(), null, null, null, valid.hiredOn(),
                null, null, null, null, null, "active", version, null, null, valid.mypadId(), null,
                valid.bornOn(), rsno, inside, education, null);
    }

    private static PersonDtos.Input input(Long manager, Long version) {
        return new PersonDtos.Input("Fictitious", "Example", null, null, null,
                LocalDate.of(2020, 1, 1), null, null, manager, null, null, "active", version,
                LocalDate.of(2018, 1, 1), "medior", "test-fictitious", null, LocalDate.of(1990, 1, 1),
                "00001", "00002", "master", null);
    }
}
