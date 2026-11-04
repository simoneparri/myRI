package it.myri.person;

import it.myri.common.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/people")
public class PersonController {
    private final PersonService service;

    public PersonController(PersonService service) { this.service = service; }

    @GetMapping
    public PageResponse<PersonDtos.View> list(@RequestParam(required = false) String q,
            @RequestParam(required = false) String status, @RequestParam(required = false) Long managerId,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "lastName,asc") String sort) {
        return service.list(q, status, managerId, includeArchived, page, size, sort);
    }

    @GetMapping("/{id}")
    public PersonDtos.View get(@PathVariable Long id) { return service.view(service.get(id)); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PersonDtos.View create(@Valid @RequestBody PersonDtos.Input input) { return service.create(input); }

    @PutMapping("/{id}")
    public PersonDtos.View update(@PathVariable Long id, @Valid @RequestBody PersonDtos.Input input) {
        return service.update(id, input);
    }

    @PostMapping("/{id}/archive")
    public PersonDtos.View archive(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.archive(id, command.version());
    }
}
