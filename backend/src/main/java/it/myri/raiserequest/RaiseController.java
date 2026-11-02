package it.myri.raiserequest;

import it.myri.common.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/raise-requests")
public class RaiseController {
    private final RaiseService service;
    public RaiseController(RaiseService service) { this.service = service; }

    @GetMapping
    public PageResponse<RaiseDtos.View> list(@RequestParam(required = false) Long personId,
            @RequestParam(required = false) String q, @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "requestedOn,desc") String sort) {
        return service.list(personId, q, status, includeArchived, page, size, sort);
    }
    @GetMapping("/{id}")
    public RaiseDtos.View get(@PathVariable Long id) { return service.detail(id); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RaiseDtos.View create(@Valid @RequestBody RaiseDtos.Input input) { return service.create(input); }
    @PutMapping("/{id}")
    public RaiseDtos.View update(@PathVariable Long id, @Valid @RequestBody RaiseDtos.Input input) {
        return service.update(id, input);
    }
    @PostMapping("/{id}/submit")
    public RaiseDtos.View submit(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.submit(id, command.version());
    }
    @PostMapping("/{id}/reopen")
    public RaiseDtos.View reopen(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.reopen(id, command.version());
    }
    @PostMapping("/{id}/approve")
    public RaiseDtos.View approve(@PathVariable Long id, @Valid @RequestBody RaiseDtos.Outcome command) {
        return service.approve(id, command);
    }
    @PostMapping("/{id}/reject")
    public RaiseDtos.View reject(@PathVariable Long id, @Valid @RequestBody RaiseDtos.Decision command) {
        return service.decide(id, command, "rejected");
    }
    @PostMapping("/{id}/postpone")
    public RaiseDtos.View postpone(@PathVariable Long id, @Valid @RequestBody RaiseDtos.Decision command) {
        return service.decide(id, command, "postponed");
    }
    @PostMapping("/{id}/archive")
    public RaiseDtos.View archive(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.archive(id, command.version());
    }
}
