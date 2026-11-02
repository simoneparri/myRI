package it.myri.salary;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public final class SalaryDtos {
    private SalaryDtos() {}
    @io.swagger.v3.oas.annotations.media.Schema(name = "SalaryInput")
    public record Input(@NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
            @NotNull @Pattern(regexp = "[A-Z]{3}") String currency,
            @NotNull LocalDate effectiveOn, @NotBlank @Size(max = 10000) String reason,
            @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,100}") String requestKey) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "SalaryView")
    public record View(Long id, Long personId, BigDecimal amount, String currency, LocalDate effectiveOn,
            String reason, Long sourceRaiseRequestId, Instant createdAt) {}

    public static View view(Salary salary) {
        return new View(salary.id, salary.personId, salary.amount, salary.currency,
                salary.effectiveOn, salary.reason, salary.sourceRaiseRequestId, salary.createdAt);
    }
}
