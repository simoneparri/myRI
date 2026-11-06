package it.myri.salary;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public final class SalaryComparisonDtos {
    private SalaryComparisonDtos() {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "SalaryComparisonView")
    public record View(Long personId, String firstName, String lastName, String role, String seniorityLevel,
            String status, Instant archivedAt, LocalDate bornOn, Integer age, LocalDate hiredOn, String seniority,
            Long salaryId, BigDecimal amount, String currency, LocalDate effectiveOn, String classificationLevel,
            Boolean mealVouchers, BigDecimal bonusLetterAmount, Boolean companyCar) {}
}
