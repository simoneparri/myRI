package it.myri.auth;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.Clock;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class AccountServiceTest {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final AccountService service = new AccountService(users, passwords, Clock.systemUTC());

    @Test
    void bootstrapNeverResetsExistingAccount() {
        when(users.findBySingletonKey((byte) 1)).thenReturn(Optional.of(new AppUser()));
        service.bootstrap("", "");
        verify(users, never()).saveAndFlush(any());
        verifyNoInteractions(passwords);
    }

    @Test
    void bootstrapRejectsMissingWeakAndBcryptTruncatedPasswords() {
        when(users.findBySingletonKey((byte) 1)).thenReturn(Optional.empty());
        assertThrows(IllegalStateException.class, () -> service.bootstrap("", "valid-long-password"));
        assertThrows(IllegalStateException.class, () -> service.bootstrap("owner", "short"));
        assertThrows(IllegalStateException.class, () -> service.bootstrap("owner", "x".repeat(73)));
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void bootstrapHashesPasswordAndSavesAccount() {
        when(users.findBySingletonKey((byte) 1)).thenReturn(Optional.empty());
        when(passwords.encode("fictitious-password")).thenReturn("hash");
        service.bootstrap("owner", "fictitious-password");
        verify(passwords).encode("fictitious-password");
        verify(users).saveAndFlush(argThat(user -> user.username.equals("owner")
                && user.passwordHash.equals("hash") && user.createdAt != null));
    }
}
