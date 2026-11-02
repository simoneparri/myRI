package it.myri.audit;

import it.myri.auth.AccountPrincipal;
import it.myri.common.*;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
    private final AuditRepository events;
    private final Clock clock;

    public AuditService(AuditRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(Long personId, Long salaryId, Long requestId, String action, String fields) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AccountPrincipal actor)) {
            throw new AuthenticationCredentialsNotFoundException("Attore audit non disponibile.");
        }
        AuditEvent event = new AuditEvent();
        event.actorId = actor.id();
        event.personId = personId;
        event.salaryId = salaryId;
        event.raiseRequestId = requestId;
        event.action = action;
        event.changedFields = fields;
        event.occurredAt = clock.instant();
        events.saveAndFlush(event);
    }

    @io.swagger.v3.oas.annotations.media.Schema(name = "AuditView")
    public record View(Long id, Long actorId, Long personId, Long salaryId, Long raiseRequestId,
            String action, String changedFields, Instant occurredAt) {}

    @Transactional(readOnly = true)
    public PageResponse<View> list(Long personId, Long salaryId, Long requestId,
            Instant from, Instant to, int page, int size) {
        return PageResponse.of(events.findAll(Queries.<AuditEvent>equal("personId", personId)
                .and(Queries.equal("salaryId", salaryId)).and(Queries.equal("raiseRequestId", requestId))
                .and(Queries.between("occurredAt", from, to)),
                Queries.page(page, size, "occurredAt,desc", Set.of("occurredAt"))),
                e -> new View(e.id, e.actorId, e.personId, e.salaryId, e.raiseRequestId,
                        e.action, e.changedFields, e.occurredAt));
    }
}
