package it.myri.export;

import it.myri.common.ApiException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/people/{id}/export")
public class PersonExportController {
    private final PersonExportService service;
    public PersonExportController(PersonExportService service) { this.service = service; }
    @GetMapping
    public ResponseEntity<?> export(@PathVariable Long id, @RequestParam(defaultValue = "json") String format) {
        if (!format.equals("json") && !format.equals("csv")) throw ApiException.invalid("Formato export non valido.");
        var snapshot = service.snapshot(id);
        Object body = format.equals("csv") ? service.csv(snapshot).getBytes(StandardCharsets.UTF_8) : snapshot;
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"person-export." + format + "\"")
                .contentType(format.equals("csv") ? new MediaType("text", "csv", StandardCharsets.UTF_8) : MediaType.APPLICATION_JSON)
                .body(body);
    }
}
