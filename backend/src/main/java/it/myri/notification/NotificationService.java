package it.myri.notification;

import it.myri.common.*;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class NotificationService {
    private final NotificationRepository notifications;
    private final Clock clock;
    public NotificationService(NotificationRepository notifications, Clock clock) {
        this.notifications = notifications;
        this.clock = clock;
    }

    @io.swagger.v3.oas.annotations.media.Schema(name = "NotificationView")
    public record View(Long id, String kind, Long personId, Long taskId, Instant triggeredAt,
            Instant readAt, Instant archivedAt, Long version) {}

    @Transactional(readOnly = true)
    public PageResponse<View> list(String kind, boolean unreadOnly, boolean includeArchived, int page, int size) {
        Queries.value(kind, Set.of("task_due", "career_talk_due"));
        org.springframework.data.jpa.domain.Specification<Notification> unread =
                (r, q, cb) -> unreadOnly ? cb.isNull(r.get("readAt")) : cb.conjunction();
        return PageResponse.of(notifications.findAll(Queries.<Notification>visible(includeArchived)
                .and(Queries.equal("kind", kind)).and(unread),
                Queries.page(page, size, "triggeredAt,desc", Set.of("triggeredAt"))), this::view);
    }

    public View mark(Long id, Long version, boolean archive) {
        Notification item = notifications.findById(id).orElseThrow(ApiException::missing);
        if (!Objects.equals(version, item.version)) { throw ApiException.conflict("Versione obsoleta."); }
        if (archive) {
            if (item.archivedAt == null) { item.archivedAt = clock.instant(); }
        } else if (item.readAt == null) {
            item.readAt = clock.instant();
        }
        return view(notifications.saveAndFlush(item));
    }

    private View view(Notification n) {
        return new View(n.id, n.kind, n.personId, n.taskId, n.triggeredAt, n.readAt, n.archivedAt, n.version);
    }
}
