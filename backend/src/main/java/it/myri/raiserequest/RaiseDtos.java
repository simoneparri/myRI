package it.myri.raiserequest;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import it.myri.salary.SalaryDtos;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public final class RaiseDtos {
    private RaiseDtos() {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "RaiseInput")
    public record Input(@NotNull @Positive Long personId, @NotNull @Positive Long baseSalaryId,
            @NotNull LocalDate requestedOn,
            @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal requestedSalary,
            @DecimalMin("0.0001") @Digits(integer = 5, fraction = 4) BigDecimal requestedPercentage,
            @NotBlank @Size(max = 10000) String motivation, @PositiveOrZero Long version) {}

    public record Outcome(@NotNull @PositiveOrZero Long version, @NotNull LocalDate outcomeOn,
            @Size(max = 10000) String outcomeNotes, @NotNull Boolean createSalary, LocalDate effectiveOn,
            @Valid SalaryDtos.Benefits benefits) {}

    public record Decision(@NotNull @PositiveOrZero Long version, @NotNull LocalDate outcomeOn,
            @Size(max = 10000) String outcomeNotes) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "RaiseView")
    public record View(Long id, Long personId, Long baseSalaryId, String currency, LocalDate requestedOn,
            BigDecimal requestedSalary, BigDecimal requestedPercentage, String motivation, String status,
            LocalDate outcomeOn, String outcomeNotes, Long salaryId, Instant archivedAt,
            Instant createdAt, Instant updatedAt, Long version) {}

    public static View view(RaiseRequest r, Long salaryId) {
        return new View(r.id, r.personId, r.baseSalaryId, r.currency, r.requestedOn, r.requestedSalary,
                r.requestedPercentage, r.motivation, r.status, r.outcomeOn, r.outcomeNotes, salaryId,
                r.archivedAt, r.createdAt, r.updatedAt, r.version);
    }

    public static void apply(RaiseRequest r, Input input) {
        r.personId = input.personId();
        r.baseSalaryId = input.baseSalaryId();
        r.requestedOn = input.requestedOn();
        r.requestedSalary = input.requestedSalary();
        r.requestedPercentage = input.requestedPercentage();
        r.motivation = input.motivation();
    }
}
