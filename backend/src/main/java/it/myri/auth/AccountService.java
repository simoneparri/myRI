package it.myri.auth;

import it.myri.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService implements UserDetailsService {
    private final AppUserRepository users;
    private final PasswordEncoder passwords;
    private final Clock clock;

    public AccountService(AppUserRepository users, PasswordEncoder passwords, Clock clock) {
        this.users = users;
        this.passwords = passwords;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) {
        return new AccountPrincipal(users.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Credenziali non valide.")));
    }

    @Transactional
    public void bootstrap(String username, String password) {
        if (users.findBySingletonKey((byte) 1).isPresent()) {
            return;
        }
        if (username == null || username.isBlank() || username.length() > 100) {
            throw new IllegalStateException("APP_USERNAME obbligatorio al primo avvio.");
        }
        validatePassword(password);
        AppUser user = new AppUser();
        user.username = username.strip();
        user.passwordHash = passwords.encode(password);
        user.createdAt = clock.instant();
        user.updatedAt = user.createdAt;
        users.saveAndFlush(user);
    }

    @Transactional
    public void reset(String password) {
        validatePassword(password);
        AppUser user = users.lockSingleton().orElseThrow(ApiException::missing);
        user.passwordHash = passwords.encode(password);
        user.updatedAt = clock.instant();
        users.saveAndFlush(user);
    }

    static void validatePassword(String password) {
        if (password == null || password.length() < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("Password obbligatoria: almeno 12 caratteri, massimo 72 byte UTF-8.");
        }
    }
}
