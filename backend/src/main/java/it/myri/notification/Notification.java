package it.myri.notification;

import it.myri.common.PersistentEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Version;
import java.time.Instant;

@Entity
public class Notification extends PersistentEntity {
    public String kind;
    public String deduplicationKey;
    public Long personId;
    public Long taskId;
    public Instant triggeredAt;
    public Instant readAt;
    public Instant archivedAt;
    @Version public Long version;
}
