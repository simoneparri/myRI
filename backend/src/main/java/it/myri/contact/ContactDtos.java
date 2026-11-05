package it.myri.contact;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;

public final class ContactDtos {
    private ContactDtos() {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "ContactInput")
    public record Input(@NotBlank @Size(max = 50) String type,
            @NotBlank @Size(max = 500) String value, @Size(max = 10000) String notes,
            @PositiveOrZero Long version, LocalDate contactedOn) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "ContactView")
    public record View(Long id, Long personId, String type, String value, String notes,
            Instant archivedAt, Instant createdAt, Instant updatedAt, Long version, LocalDate contactedOn) {}

    public static View view(Contact c) {
        return new View(c.id, c.personId, c.type, c.value, c.notes,
                c.archivedAt, c.createdAt, c.updatedAt, c.version, c.contactedOn);
    }

    public static void apply(Contact c, Input input) {
        it.myri.common.Dates.check(input.contactedOn());
        c.type = input.type().strip();
        c.value = input.value().strip();
        c.notes = input.notes();
        c.contactedOn = input.contactedOn();
    }
}
