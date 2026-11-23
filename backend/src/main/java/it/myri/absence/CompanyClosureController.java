package it.myri.absence;

import it.myri.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/company-closures")
public class CompanyClosureController {
    private final CompanyClosureService service;

    public CompanyClosureController(CompanyClosureService service) { this.service = service; }

    public record Input(@NotNull LocalDate date) {}

    @GetMapping
    public List<LocalDate> list(@RequestParam String month) {
        try {
            YearMonth parsed = YearMonth.parse(month);
            if (parsed.getYear() < 1000 || parsed.getYear() > 9998) throw new DateTimeParseException("", month, 0);
            return service.month(parsed);
        } catch (DateTimeParseException exception) {
            throw ApiException.invalid("Mese non valido: usare il formato AAAA-MM.");
        }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void add(@Valid @RequestBody Input input) { service.add(input.date()); }

    @PostMapping("/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@Valid @RequestBody Input input) { service.cancel(input.date()); }
}
