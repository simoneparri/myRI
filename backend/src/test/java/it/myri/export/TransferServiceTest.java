package it.myri.export;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import it.myri.audit.AuditService;
import it.myri.auth.*;
import it.myri.careertalk.CareerTalkRepository;
import it.myri.common.ApiException;
import it.myri.contact.ContactRepository;
import it.myri.person.*;
import it.myri.project.ProjectRepository;
import it.myri.raiserequest.RaiseRequestRepository;
import it.myri.salary.SalaryRepository;
import it.myri.task.TaskRepository;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class TransferServiceTest {
    private final PersonService people = mock(PersonService.class);
    private final PersonRepository persons = mock(PersonRepository.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final ContactRepository contacts = mock(ContactRepository.class);
    private final TransferMapper mapper = mock(TransferMapper.class);
    private final TransferService service = new TransferService(mock(PersonExportService.class),
            people, persons, users, contacts, mock(ProjectRepository.class), mock(CareerTalkRepository.class),
            mock(SalaryRepository.class), mock(RaiseRequestRepository.class), mock(TaskRepository.class),
            mapper, mock(AuditService.class), Clock.systemUTC());

    @Test
    void singletonLockPrecedesDuplicateChecksAndNeitherPersonNorDetailsAreWritten() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(persons.existsByRsnoAgresso("001")).thenReturn(true);
        var result = service.importFile(bundle("001", "pad-1"));
        assertEquals(0, result.imported());
        assertEquals(1, result.skipped());
        assertEquals("rsno_agresso", result.results().getFirst().reason());
        var order = inOrder(users, persons);
        order.verify(users).lockSingleton();
        order.verify(persons).existsByRsnoAgresso("001");
        order.verify(persons).existsByMypadId("pad-1");
        verifyNoInteractions(people, contacts, mapper);
    }

    @Test
    void mypadAloneAlsoSkipsAndNullIdentifiersAreNeverQueried() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(persons.existsByMypadId("pad-1")).thenReturn(true);
        assertEquals("mypad_id", service.importFile(bundle(null, "pad-1")).results().getFirst().reason());
        verify(persons, never()).existsByRsnoAgresso(any());
        verifyNoInteractions(people, contacts, mapper);
    }

    @Test
    void invalidFormatFailsBeforeDatabaseAccess() {
        assertThrows(ApiException.class, () -> service.importFile(new TransferDtos.Bundle("other", 1, Instant.now(), List.of())));
        verifyNoInteractions(users, persons, people, contacts);
    }

    private TransferDtos.Bundle bundle(String rsno, String mypad) {
        Person p = new Person();
        p.id = 1L;
        p.hiredOn = LocalDate.of(2020, 1, 1);
        p.rsnoAgresso = rsno;
        p.mypadId = mypad;
        var data = new PersonExportService.Snapshot(1, Instant.now(),
                PersonMapper.view(p, LocalDate.of(2026, 1, 1)),
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        return new TransferDtos.Bundle("myri-transfer", 1, Instant.now(),
                List.of(new TransferDtos.Entry(data, null)));
    }
}
