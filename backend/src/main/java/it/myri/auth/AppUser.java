package it.myri.auth;

import it.myri.common.PersistentEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;

@Entity
@Table(name = "app_user")
public class AppUser extends PersistentEntity {
    public byte singletonKey = 1;
    public String username;
    public String passwordHash;
    public Instant disabledAt;
    public Instant updatedAt;
    @Version
    public Long version;
}
