package it.myri.careertalk;

import it.myri.common.*;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/career-talks")
public class CareerTalkController {
    private final CareerTalkService service;
    public CareerTalkController(CareerTalkService service) { this.service = service; }

    @GetMapping
    public PageResponse<CareerTalkDtos.View> list(@RequestParam(required = false) Long personId,
            @RequestParam(required = false) String q, @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "heldAt,desc") String sort) {
        return service.list(personId, q, from, to, includeArchived, page, size, sort);
    }

    @GetMapping("/{id}")
    public CareerTalkDtos.View get(@PathVariable Long id) { return CareerTalkDtos.view(service.get(id)); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CareerTalkDtos.View create(@Valid @RequestBody CareerTalkDtos.Input input) { return service.create(input); }

    @PutMapping("/{id}")
    public CareerTalkDtos.View update(@PathVariable Long id, @Valid @RequestBody CareerTalkDtos.Input input) {
        return service.update(id, input);
    }

    @PostMapping("/{id}/archive")
    public CareerTalkDtos.View archive(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.archive(id, command.version());
    }
}
