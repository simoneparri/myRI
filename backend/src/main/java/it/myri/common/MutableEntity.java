package it.myri.common;

import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import java.time.Instant;

@MappedSuperclass
public abstract class MutableEntity extends PersistentEntity {
    public Instant updatedAt;
    public Instant archivedAt;

    @Version
    public Long version;
}
