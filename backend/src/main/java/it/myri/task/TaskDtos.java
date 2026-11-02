package it.myri.task;

import jakarta.validation.constraints.*;
import java.time.Instant;

public final class TaskDtos {
    private TaskDtos() {}
    @io.swagger.v3.oas.annotations.media.Schema(name = "TaskInput")
    public record Input(@NotBlank @Size(max = 200) String title,
            @Size(max = 10000) String description, Instant dueAt,
            @NotNull @Pattern(regexp = "low|medium|high") String priority,
            @NotNull @Pattern(regexp = "todo|in_progress") String status,
            @Positive Long personId, @Positive Long careerTalkId, @Positive Long raiseRequestId,
            @Pattern(regexp = "daily|weekly|monthly") String recurrenceFrequency,
            @Positive Integer recurrenceInterval, @PositiveOrZero Long version) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "TaskView")
    public record View(Long id, String title, String description, Instant dueAt, String priority,
            String status, Long personId, Long careerTalkId, Long raiseRequestId,
            String recurrenceFrequency, Integer recurrenceInterval, Long sourceTaskId,
            Instant completedAt, Instant archivedAt, Instant createdAt, Instant updatedAt, Long version) {}

    public record Completion(View task, View nextOccurrence) {}

    public static View view(Task task) {
        return new View(task.id, task.title, task.description, task.dueAt, task.priority,
                task.status, task.personId, task.careerTalkId, task.raiseRequestId,
                task.recurrenceFrequency, task.recurrenceInterval, task.sourceTaskId,
                task.completedAt, task.archivedAt, task.createdAt, task.updatedAt, task.version);
    }

    public static void apply(Task task, Input input) {
        task.title = input.title().strip();
        task.description = input.description();
        task.dueAt = input.dueAt();
        task.priority = input.priority();
        task.status = input.status();
        task.personId = input.personId();
        task.careerTalkId = input.careerTalkId();
        task.raiseRequestId = input.raiseRequestId();
        task.recurrenceFrequency = input.recurrenceFrequency();
        task.recurrenceInterval = input.recurrenceInterval();
    }
}
