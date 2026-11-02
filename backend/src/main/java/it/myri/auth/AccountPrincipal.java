package it.myri.auth;

import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.CredentialsContainer;

public final class AccountPrincipal implements UserDetails, CredentialsContainer {
    private final Long id;
    private final Long credentialVersion;
    private final String username;
    private String password;
    private final boolean enabled;

    public AccountPrincipal(AppUser user) {
        id = user.id;
        credentialVersion = user.version;
        username = user.username;
        password = user.passwordHash;
        enabled = user.disabledAt == null;
    }

    public Long id() { return id; }
    public Long credentialVersion() { return credentialVersion; }
    @Override public String getUsername() { return username; }
    @Override public String getPassword() { return password; }
    @Override public void eraseCredentials() { password = null; }
    @Override public boolean isEnabled() { return enabled; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_OWNER"));
    }
}
