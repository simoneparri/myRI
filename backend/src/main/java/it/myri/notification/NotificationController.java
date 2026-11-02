package it.myri.notification;

import it.myri.common.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService service;
    public NotificationController(NotificationService service) { this.service = service; }
    @GetMapping
    public PageResponse<NotificationService.View> list(@RequestParam(required = false) String kind,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(kind, unreadOnly, includeArchived, page, size);
    }
    @PostMapping("/{id}/read")
    public NotificationService.View read(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.mark(id, command.version(), false);
    }
    @PostMapping("/{id}/archive")
    public NotificationService.View archive(@PathVariable Long id, @Valid @RequestBody VersionCommand command) {
        return service.mark(id, command.version(), true);
    }
}
