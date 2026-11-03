package it.myri.reminder;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import org.junit.jupiter.api.Test;

class CalendarWindowsTest {
    private final ZoneId zone = ZoneId.of("Europe/Rome");
    @Test
    void todayHonorsBothDstBoundariesAndNextSevenStartsTomorrow() {
        var spring = CalendarWindows.today(Instant.parse("2026-03-29T10:00:00Z"), zone);
        assertEquals(23, Duration.between(spring.from(), spring.to()).toHours());
        var autumn = CalendarWindows.today(Instant.parse("2026-10-25T10:00:00Z"), zone);
        assertEquals(25, Duration.between(autumn.from(), autumn.to()).toHours());
        var next = CalendarWindows.nextSeven(Instant.parse("2026-03-28T12:00:00Z"), zone);
        assertEquals(LocalDate.of(2026, 3, 29), next.from().atZone(zone).toLocalDate());
        assertEquals(LocalDate.of(2026, 4, 5), next.to().atZone(zone).toLocalDate());
    }
    @Test
    void careerThresholdIsStrictAndUsesLocalDateNotUtc() {
        var person = new CareerDueRepository.Candidate(1L, "Fittizia", "Test",
                LocalDate.of(2026, 1, 31), null, null);
        assertFalse(person.due(Instant.parse("2026-04-30T12:00:00Z"), zone, 3));
        assertTrue(person.due(Instant.parse("2026-04-30T22:00:00Z"), zone, 3));
        var talk = new CareerDueRepository.Candidate(1L, "Fittizia", "Test",
                LocalDate.of(2020, 1, 1), 2L, Instant.parse("2026-01-30T23:30:00Z"));
        assertEquals(LocalDate.of(2026, 1, 31), talk.reference(zone));
    }
    @Test
    void reminderConfigurationRejectsUnsafeBounds() {
        try (var factory = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertTrue(validator.validate(new ReminderSettings(3, 60000)).isEmpty());
            assertEquals(2, validator.validate(new ReminderSettings(0, 999)).size());
            assertEquals(2, validator.validate(new ReminderSettings(121, 86400001)).size());
        }
    }
}
