package it.myri.task;

import it.myri.careertalk.CareerTalkService;
import it.myri.common.*;
import it.myri.person.PersonService;
import it.myri.raiserequest.RaiseService;
import java.time.*;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TaskService {
    private final TaskRepository tasks;
    private final PersonService people;
    private final CareerTalkService talks;
    private final RaiseService raises;
    private final Clock clock;
    private final ZoneId zone;

    public TaskService(TaskRepository tasks, PersonService people, CareerTalkService talks,
            RaiseService raises, Clock clock, ZoneId zone) {
        this.tasks = tasks;
        this.people = people;
        this.talks = talks;
        this.raises = raises;
        this.clock = clock;
        this.zone = zone;
    }

    @Transactional(readOnly = true)
    public Task get(Long id) { return tasks.findById(id).orElseThrow(ApiException::missing); }

    @Transactional(readOnly = true)
    public PageResponse<TaskDtos.View> list(Long personId, String q, String status, String priority,
            Instant from, Instant to, boolean includeArchived, int page, int size, String sort) {
        Queries.value(status, Set.of("todo", "in_progress", "done", "cancelled"));
        Queries.value(priority, Set.of("low", "medium", "high"));
        return PageResponse.of(tasks.findAll(Queries.<Task>visible(includeArchived)
                .and(Queries.equal("personId", personId)).and(Queries.equal("status", status))
                .and(Queries.equal("priority", priority)).and(Queries.text(q, "title", "description"))
                .and(Queries.between("dueAt", from, to)),
                Queries.page(page, size, sort, Set.of("id", "dueAt", "createdAt", "priority", "status"))), TaskDtos::view);
    }

    public TaskDtos.View create(TaskDtos.Input input) {
        Task task = new Task();
        task.initialize(clock);
        TaskDtos.apply(task, input);
        validate(task);
        return TaskDtos.view(tasks.saveAndFlush(task));
    }

    public TaskDtos.View update(Long id, TaskDtos.Input input) {
        Task task = tasks.lockById(id).orElseThrow(ApiException::missing);
        editable(task, input.version());
        TaskDtos.apply(task, input);
        validate(task);
        task.touch(clock);
        return TaskDtos.view(tasks.saveAndFlush(task));
    }

    public TaskDtos.Completion complete(Long id, Long version) {
        Task task = tasks.lockById(id).orElseThrow(ApiException::missing);
        if (task.status.equals("done")) {
            return new TaskDtos.Completion(TaskDtos.view(task),
                    tasks.findBySourceTaskId(id).map(TaskDtos::view).orElse(null));
        }
        editable(task, version);
        validate(task);
        task.status = "done";
        task.completedAt = clock.instant();
        task.touch(clock);
        tasks.saveAndFlush(task);
        Task next = null;
        if (task.recurrenceFrequency != null) {
            Task root = root(task);
            next = new Task();
            next.initialize(clock);
            next.title = task.title;
            next.description = task.description;
            next.priority = task.priority;
            next.status = "todo";
            next.personId = task.personId;
            next.careerTalkId = task.careerTalkId;
            next.raiseRequestId = task.raiseRequestId;
            next.recurrenceFrequency = task.recurrenceFrequency;
            next.recurrenceInterval = task.recurrenceInterval;
            next.sourceTaskId = task.id;
            next.dueAt = Recurrence.next(root.dueAt, task.dueAt, clock.instant(),
                    task.recurrenceFrequency, task.recurrenceInterval, zone);
            tasks.saveAndFlush(next);
        }
        return new TaskDtos.Completion(TaskDtos.view(task), next == null ? null : TaskDtos.view(next));
    }

    public TaskDtos.View cancel(Long id, Long version) {
        Task task = tasks.lockById(id).orElseThrow(ApiException::missing);
        editable(task, version);
        task.status = "cancelled";
        task.touch(clock);
        return TaskDtos.view(tasks.saveAndFlush(task));
    }

    public TaskDtos.View archive(Long id, Long version) {
        Task task = tasks.lockById(id).orElseThrow(ApiException::missing);
        task.archive(version, clock);
        return TaskDtos.view(tasks.saveAndFlush(task));
    }

    private void editable(Task task, Long version) {
        Queries.editable(task);
        Queries.version(task, version);
        if (Set.of("done", "cancelled").contains(task.status)) {
            throw ApiException.conflict("Il task e gia concluso.");
        }
    }

    private void validate(Task task) {
        Dates.check(task.dueAt);
        Long person = task.personId;
        if (task.careerTalkId != null) {
            var talk = talks.get(task.careerTalkId);
            Queries.editable(talk);
            person = samePerson(person, talk.personId);
        }
        if (task.raiseRequestId != null) {
            var request = raises.get(task.raiseRequestId);
            Queries.editable(request);
            person = samePerson(person, request.personId);
        }
        if (person != null) { people.requireUsable(person); }
        task.personId = person;
        if ((task.recurrenceFrequency == null) != (task.recurrenceInterval == null)
                || (task.recurrenceFrequency != null && task.dueAt == null)) {
            throw ApiException.invalid("Specificare frequenza, intervallo e scadenza insieme.");
        }
        if (task.recurrenceFrequency != null) {
            Recurrence.next(task.dueAt, task.dueAt, clock.instant(),
                    task.recurrenceFrequency, task.recurrenceInterval, zone);
        }
    }

    private Long samePerson(Long current, Long related) {
        if (current != null && !Objects.equals(current, related)) {
            throw ApiException.invalid("I collegamenti del task devono riguardare la stessa persona.");
        }
        return related;
    }

    private Task root(Task task) {
        Set<Long> visited = new HashSet<>();
        while (task.sourceTaskId != null) {
            if (!visited.add(task.id)) { throw ApiException.conflict("Catena ricorrenza non valida."); }
            task = get(task.sourceTaskId);
        }
        return task;
    }
}
