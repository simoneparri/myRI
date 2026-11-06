package it.myri.notification;

import it.myri.common.*;
import it.myri.person.Person;
import it.myri.person.PersonRepository;
import it.myri.task.Task;
import it.myri.task.TaskRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class NotificationService {
    private final NotificationRepository notifications;
    private final PersonRepository people;
    private final TaskRepository tasks;
    private final Clock clock;
    public NotificationService(NotificationRepository notifications, PersonRepository people,
            TaskRepository tasks, Clock clock) {
        this.notifications = notifications;
        this.people = people;
        this.tasks = tasks;
        this.clock = clock;
    }

    @io.swagger.v3.oas.annotations.media.Schema(name = "NotificationView")
    public record View(Long id, String kind, Long personId, Long taskId, Instant triggeredAt,
            Instant readAt, Instant archivedAt, Long version, String personName, String taskTitle) {}

    @Transactional(readOnly = true)
    public PageResponse<View> list(String kind, boolean unreadOnly, boolean includeArchived, int page, int size) {
        Queries.value(kind, Set.of("task_due", "career_talk_due"));
        org.springframework.data.jpa.domain.Specification<Notification> unread =
                (r, q, cb) -> unreadOnly ? cb.isNull(r.get("readAt")) : cb.conjunction();
        var result = notifications.findAll(Queries.<Notification>visible(includeArchived)
                .and(Queries.equal("kind", kind)).and(unread),
                Queries.page(page, size, "triggeredAt,desc", Set.of("triggeredAt")));
        // Labels are loaded once per page to avoid one lookup per notification.
        Map<Long, Task> taskById = tasks.findAllById(result.stream().map(n -> n.taskId)
                .filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(t -> t.id, Function.identity()));
        Set<Long> personIds = result.stream().map(n -> n.personId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        taskById.values().stream().map(t -> t.personId).filter(Objects::nonNull).forEach(personIds::add);
        Map<Long, String> names = people.findAllById(personIds).stream()
                .collect(Collectors.toMap(p -> p.id, NotificationService::fullName));
        return PageResponse.of(result, n -> view(n, names::get, taskById::get));
    }

    public View mark(Long id, Long version, boolean archive) {
        Notification item = notifications.findById(id).orElseThrow(ApiException::missing);
        if (!Objects.equals(version, item.version)) { throw ApiException.conflict("Versione obsoleta."); }
        if (archive) {
            if (item.archivedAt == null) { item.archivedAt = clock.instant(); }
        } else if (item.readAt == null) {
            item.readAt = clock.instant();
        }
        Notification saved = notifications.saveAndFlush(item);
        return view(saved,
                personId -> people.findById(personId).map(NotificationService::fullName).orElse(null),
                taskId -> tasks.findById(taskId).orElse(null));
    }

    static String fullName(Person person) {
        return person.lastName + " " + person.firstName;
    }

    private static View view(Notification n, Function<Long, String> names, Function<Long, Task> tasks) {
        Task task = n.taskId == null ? null : tasks.apply(n.taskId);
        // Task notifications carry only task_id: the target person comes from the task.
        Long personId = n.personId != null ? n.personId : task == null ? null : task.personId;
        return new View(n.id, n.kind, n.personId, n.taskId, n.triggeredAt, n.readAt, n.archivedAt, n.version,
                personId == null ? null : names.apply(personId),
                task == null ? null : task.title);
    }
}
