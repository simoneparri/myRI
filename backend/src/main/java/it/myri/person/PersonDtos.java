package it.myri.person;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;

public final class PersonDtos {
    private PersonDtos() {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "PersonInput")
    public record Input(
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @Email @Size(max = 254) String email,
            @Size(max = 50) String phone,
            @Size(max = 150) String role,
            @Size(max = 100) String seniority,
            @NotNull LocalDate hiredOn,
            @Positive Long managerId,
            @Pattern(regexp = ".*\\S.*") @Size(max = 200) String externalManager,
            @Size(max = 10000) String notes,
            @NotNull @Pattern(regexp = "active|inactive") String status,
            @PositiveOrZero Long version) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "PersonView")
    public record View(Long id, String firstName, String lastName, String email,
            String phone, String role, String seniority, LocalDate hiredOn,
            Long managerId, String externalManager, String notes, String status,
            Instant archivedAt, Instant createdAt, Instant updatedAt, Long version) {}
}
