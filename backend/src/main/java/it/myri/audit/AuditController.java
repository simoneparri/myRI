package it.myri.audit;

import it.myri.common.PageResponse;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {
    private final AuditService audit;
    public AuditController(AuditService audit) { this.audit = audit; }

    @GetMapping
    public PageResponse<AuditService.View> list(@RequestParam(required = false) Long personId,
            @RequestParam(required = false) Long salaryId, @RequestParam(required = false) Long requestId,
            @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return audit.list(personId, salaryId, requestId, from, to, page, size);
    }
}
