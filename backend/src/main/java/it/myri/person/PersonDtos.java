package it.myri.person;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class PersonDtos {
    private PersonDtos() {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "PersonInput")
    public record Input(
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @Email @Size(max = 254) String email,
            @Size(max = 50) String phone,
            @Size(max = 150) String role,
            @NotNull LocalDate hiredOn,
            @Size(max = 200) String hiringLocation,
            @Size(max = 500) String residence,
            @Positive Long managerId,
            @Pattern(regexp = ".*\\S.*") @Size(max = 200) String externalManager,
            @Size(max = 10000) String notes,
            @NotNull @Pattern(regexp = "active|inactive") String status,
            @PositiveOrZero Long version,
            LocalDate careerStartedOn,
            @Pattern(regexp = "junior|medior|senior") String seniorityLevel,
            @Size(max = 100) @Pattern(regexp = "[A-Za-z0-9_-]+") String mypadId,
            @Size(max = 50) List<@NotBlank @Size(max = 100) @Pattern(regexp = "[^\\r\\n]+") String> frameworks,
            LocalDate bornOn,
            @Size(max = 100) @Pattern(regexp = "[^\\r\\n]*\\S[^\\r\\n]*") String rsnoAgresso,
            @Size(max = 100) @Pattern(regexp = "[^\\r\\n]*\\S[^\\r\\n]*") String insideId,
            @Pattern(regexp = "diploma|bachelor|master|phd") String education) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "PersonView")
    public record View(Long id, String firstName, String lastName, String email,
            String phone, String role, LocalDate hiredOn, String seniority,
            String hiringLocation, String residence,
            Long managerId, String externalManager, String notes, String status,
            Instant archivedAt, Instant createdAt, Instant updatedAt, Long version,
            LocalDate careerStartedOn, String careerDuration, String seniorityLevel, String mypadId,
            List<String> frameworks, LocalDate bornOn, Integer age,
            String rsnoAgresso, String insideId, String education) {}
}
