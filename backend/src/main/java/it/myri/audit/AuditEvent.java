package it.myri.audit;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
public class AuditEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public Long actorId;
    public Long personId;
    public Long salaryId;
    public Long raiseRequestId;
    public String action;
    public String changedFields;
    public Instant occurredAt;
}
