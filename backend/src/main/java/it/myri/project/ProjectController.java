package it.myri.project;

import it.myri.common.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ProjectController {
    private final ProjectService service;

    public ProjectController(ProjectService service) { this.service = service; }

    @GetMapping("/people/{personId}/projects")
    public PageResponse<ProjectDtos.View> list(@PathVariable Long personId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String period,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "startsOn,desc") String sort) {
        return service.list(personId, q, period, includeArchived, page, size, sort);
    }

    @GetMapping("/projects/{id}")
    public ProjectDtos.View get(@PathVariable Long id) { return service.view(service.get(id)); }

    @PostMapping("/people/{personId}/projects")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDtos.View create(@PathVariable Long personId, @Valid @RequestBody ProjectDtos.Input input) {
        return service.create(personId, input);
    }

    @PutMapping("/projects/{id}")
    public ProjectDtos.View update(@PathVariable Long id, @Valid @RequestBody ProjectDtos.Input input) {
        return service.update(id, input);
    }

    @PostMapping("/projects/{id}/archive")
    public ProjectDtos.View archive(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.archive(id, command.version());
    }
}
