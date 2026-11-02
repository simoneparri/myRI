package it.myri.salary;

import it.myri.common.*;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/people/{personId}/salaries")
public class SalaryController {
    private final SalaryService service;
    public SalaryController(SalaryService service) { this.service = service; }

    @GetMapping
    public PageResponse<SalaryDtos.View> list(@PathVariable Long personId,
            @RequestParam(required = false) String q, @RequestParam(required = false) String currency,
            @RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "effectiveOn,desc") String sort) {
        return service.list(personId, q, currency, from, to, page, size, sort);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SalaryDtos.View create(@PathVariable Long personId, @Valid @RequestBody SalaryDtos.Input input) {
        return service.create(personId, input);
    }
}
