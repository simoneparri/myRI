package it.myri.person;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import it.myri.auth.*;
import it.myri.common.ApiException;
import java.time.*;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class PersonServiceTest {
    private final PersonRepository repository = mock(PersonRepository.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final PersonService service = new PersonService(repository, users, Clock.systemUTC());

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

    private static Person person(Long id) {
        Person p = new Person();
        p.id = id;
        p.version = 0L;
        return p;
    }

    private static PersonDtos.Input input(Long manager, Long version) {
        return new PersonDtos.Input("Fictitious", "Example", null, null, null, null,
                LocalDate.of(2020, 1, 1), manager, null, null, "active", version);
    }
}
