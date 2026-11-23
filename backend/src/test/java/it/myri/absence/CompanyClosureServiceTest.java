package it.myri.absence;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import it.myri.auth.AppUser;
import it.myri.auth.AppUserRepository;
import it.myri.common.ApiException;
import java.time.*;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CompanyClosureServiceTest {
    private final CompanyClosureRepository repository = mock(CompanyClosureRepository.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
    private final CompanyClosureService service = new CompanyClosureService(repository, users, clock);

    @Test
    void addCancelAndRestoreUseSameDateWithoutPhysicalDeletion() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        LocalDate date = LocalDate.of(2026, 8, 14);
        CompanyClosure existing = new CompanyClosure();
        existing.closedOn = date;
        when(repository.findByClosedOn(date)).thenReturn(Optional.of(existing));
        service.add(date);
        verify(repository, never()).save(any());
        service.cancel(date);
        assertEquals(clock.instant(), existing.archivedAt);
        assertThrows(ApiException.class, () -> service.cancel(date));
        service.add(date);
        assertNull(existing.archivedAt);
        verify(repository, never()).delete(any());
        assertThrows(ApiException.class, () -> service.add(LocalDate.of(999, 1, 1)));
    }

    @Test
    void createsNewClosure() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        LocalDate date = LocalDate.of(2026, 12, 24);
        service.add(date);
        verify(repository).save(argThat(item -> item.closedOn.equals(date) && item.archivedAt == null));
    }
}
