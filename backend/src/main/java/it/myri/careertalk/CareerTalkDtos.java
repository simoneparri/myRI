package it.myri.careertalk;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;

public final class CareerTalkDtos {
    private CareerTalkDtos() {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "CareerTalkInput")
    public record Input(@NotNull @Positive Long personId, @NotNull Instant heldAt,
            @Size(max = 10000) String topics, @Size(max = 10000) String agreedGoals,
            @Size(max = 10000) String feedbackGiven, @Size(max = 10000) String feedbackReceived,
            @Size(max = 10000) String nextSteps, LocalDate suggestedNextOn,
            @PositiveOrZero Long version) {}

    @io.swagger.v3.oas.annotations.media.Schema(name = "CareerTalkView")
    public record View(Long id, Long personId, Instant heldAt, String topics,
            String agreedGoals, String feedbackGiven, String feedbackReceived, String nextSteps,
            LocalDate suggestedNextOn, Instant archivedAt, Instant createdAt, Instant updatedAt, Long version) {}

    public static View view(CareerTalk t) {
        return new View(t.id, t.personId, t.heldAt, t.topics, t.agreedGoals, t.feedbackGiven,
                t.feedbackReceived, t.nextSteps, t.suggestedNextOn,
                t.archivedAt, t.createdAt, t.updatedAt, t.version);
    }

    public static void apply(CareerTalk t, Input input) {
        t.personId = input.personId();
        t.heldAt = input.heldAt();
        t.topics = input.topics();
        t.agreedGoals = input.agreedGoals();
        t.feedbackGiven = input.feedbackGiven();
        t.feedbackReceived = input.feedbackReceived();
        t.nextSteps = input.nextSteps();
        t.suggestedNextOn = input.suggestedNextOn();
    }
}
