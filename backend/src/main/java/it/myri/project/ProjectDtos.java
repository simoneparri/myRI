package it.myri.project;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;

public final class ProjectDtos {
    private ProjectDtos() {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "ProjectInput")
    public record Input(@NotBlank @Size(max = 200) String client,
            LocalDate startsOn, LocalDate endsOn,
            @Size(max = 200) String businessManager,
            @NotNull @Pattern(regexp = "onsite|remote|hybrid") String workMode,
            @Size(max = 10000) String notes, @PositiveOrZero Long version) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "ProjectView")
    public record View(Long id, Long personId, String client, LocalDate startsOn, LocalDate endsOn,
            String businessManager, String workMode, String notes, String status,
            Instant archivedAt, Instant createdAt, Instant updatedAt, Long version) {}

    public static View view(Project project, LocalDate today) {
        String status = project.archivedAt != null ? "archived"
                : project.endsOn != null && project.endsOn.isBefore(today) ? "past"
                : project.startsOn != null && project.startsOn.isAfter(today) ? "upcoming"
                : "current";
        return new View(project.id, project.personId, project.client, project.startsOn, project.endsOn,
                project.businessManager, project.workMode, project.notes, status,
                project.archivedAt, project.createdAt, project.updatedAt, project.version);
    }

    public static void apply(Project project, Input input) {
        project.client = input.client().strip();
        project.startsOn = input.startsOn();
        project.endsOn = input.endsOn();
        project.businessManager = input.businessManager() == null ? null : input.businessManager().strip();
        project.workMode = input.workMode();
        project.notes = input.notes();
    }
}
