package it.myri.task;

import it.myri.common.*;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {
    private final TaskService service;
    public TaskController(TaskService service) { this.service = service; }

    @GetMapping
    public PageResponse<TaskDtos.View> list(@RequestParam(required = false) Long personId,
            @RequestParam(required = false) String q, @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "dueAt,asc") String sort) {
        return service.list(personId, q, status, priority, from, to, includeArchived, page, size, sort);
    }
    @GetMapping("/{id}")
    public TaskDtos.View get(@PathVariable Long id) { return TaskDtos.view(service.get(id)); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskDtos.View create(@Valid @RequestBody TaskDtos.Input input) { return service.create(input); }
    @PutMapping("/{id}")
    public TaskDtos.View update(@PathVariable Long id, @Valid @RequestBody TaskDtos.Input input) {
        return service.update(id, input);
    }
    @PostMapping("/{id}/complete")
    public TaskDtos.Completion complete(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.complete(id, command.version());
    }
    @PostMapping("/{id}/cancel")
    public TaskDtos.View cancel(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.cancel(id, command.version());
    }
    @PostMapping("/{id}/archive")
    public TaskDtos.View archive(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.archive(id, command.version());
    }
}
