package it.myri.contact;

import it.myri.common.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ContactController {
    private final ContactService service;
    public ContactController(ContactService service) { this.service = service; }

    @GetMapping("/people/{personId}/contacts")
    public PageResponse<ContactDtos.View> list(@PathVariable Long personId,
            @RequestParam(required = false) String q, @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id,asc") String sort) {
        return service.list(personId, q, type, includeArchived, page, size, sort);
    }

    @GetMapping("/contacts/{id}")
    public ContactDtos.View get(@PathVariable Long id) { return ContactDtos.view(service.get(id)); }

    @PostMapping("/people/{personId}/contacts")
    @ResponseStatus(HttpStatus.CREATED)
    public ContactDtos.View create(@PathVariable Long personId, @Valid @RequestBody ContactDtos.Input input) {
        return service.create(personId, input);
    }

    @PutMapping("/contacts/{id}")
    public ContactDtos.View update(@PathVariable Long id, @Valid @RequestBody ContactDtos.Input input) {
        return service.update(id, input);
    }

    @PostMapping("/contacts/{id}/archive")
    public ContactDtos.View archive(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.archive(id, command.version());
    }
}
