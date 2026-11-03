package it.myri.task;

import it.myri.common.*;
import it.myri.reminder.CalendarWindows;
import java.time.*;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TodoService {
    private final TaskRepository tasks;
    private final Clock clock;
    private final ZoneId zone;
    public TodoService(TaskRepository tasks, Clock clock, ZoneId zone) {
        this.tasks = tasks; this.clock = clock; this.zone = zone;
    }

    public static Specification<Task> open() {
        return (root, query, cb) -> cb.and(cb.isNull(root.get("archivedAt")),
                root.get("status").in("todo", "in_progress"));
    }

    public PageResponse<TaskDtos.View> list(String view, Long personId, int page, int size) {
        return PageResponse.of(tasks.findAll(specification(view, personId, clock.instant()),
                Queries.page(page, size, "dueAt,asc", Set.of("dueAt"))), TaskDtos::view);
    }

    public long count(String view, Instant now) {
        return tasks.count(specification(view, null, now));
    }

    private Specification<Task> specification(String view, Long personId, Instant now) {
        Queries.value(view, Set.of("today", "overdue", "next7", "all"));
        Specification<Task> spec = open().and(Queries.equal("personId", personId));
        if ("overdue".equals(view)) spec = spec.and(Queries.between("dueAt", null, now));
        else if ("today".equals(view) || "next7".equals(view)) {
            var window = "today".equals(view) ? CalendarWindows.today(now, zone) : CalendarWindows.nextSeven(now, zone);
            spec = spec.and(Queries.between("dueAt", window.from(), window.to()));
        }
        return spec;
    }
}
