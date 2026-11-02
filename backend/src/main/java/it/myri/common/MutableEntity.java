package it.myri.common;

import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.Clock;

@MappedSuperclass
public abstract class MutableEntity extends PersistentEntity {
    public Instant updatedAt;
    public Instant archivedAt;

    @Version
    public Long version;

    public void initialize(Clock clock) {
        createdAt = clock.instant();
        updatedAt = createdAt;
    }

    public void touch(Clock clock) {
        updatedAt = clock.instant();
    }

    public void archive(Long expectedVersion, Clock clock) {
        Queries.version(this, expectedVersion);
        if (archivedAt == null) {
            archivedAt = clock.instant();
            touch(clock);
        }
    }
}
