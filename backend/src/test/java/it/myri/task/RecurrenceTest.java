package it.myri.task;

import static org.junit.jupiter.api.Assertions.*;

import it.myri.common.ApiException;
import java.time.*;
import org.junit.jupiter.api.Test;

class RecurrenceTest {
    private static final ZoneId ROME = ZoneId.of("Europe/Rome");

    @Test
    void monthlyRecurrencePreservesOriginalDayAfterFebruary() {
        Instant anchor = ZonedDateTime.of(2026, 1, 31, 10, 0, 0, 0, ROME).toInstant();
        Instant february = Recurrence.next(anchor, anchor, anchor, "monthly", 1, ROME);
        assertEquals(LocalDate.of(2026, 2, 28), february.atZone(ROME).toLocalDate());
        Instant march = Recurrence.next(anchor, february, february, "monthly", 1, ROME);
        assertEquals(LocalDate.of(2026, 3, 31), march.atZone(ROME).toLocalDate());
    }

    @Test
    void lateCompletionSkipsMissedOccurrences() {
        Instant start = Instant.parse("2026-01-01T09:00:00Z");
        Instant now = Instant.parse("2026-02-15T10:00:00Z");
        assertEquals(Instant.parse("2026-02-16T09:00:00Z"),
                Recurrence.next(start, start, now, "daily", 1, ROME));
    }

    @Test
    void nonexistentDstTimeMovesForwardAndOverlapKeepsAnchorOffset() {
        Instant beforeGap = ZonedDateTime.of(2026, 3, 28, 2, 30, 0, 0, ROME).toInstant();
        var gap = Recurrence.next(beforeGap, beforeGap, beforeGap, "daily", 1, ROME).atZone(ROME);
        assertEquals(LocalTime.of(3, 30), gap.toLocalTime());
        Instant beforeOverlap = ZonedDateTime.of(2026, 10, 24, 2, 30, 0, 0, ROME).toInstant();
        var overlap = Recurrence.next(beforeOverlap, beforeOverlap, beforeOverlap, "daily", 1, ROME).atZone(ROME);
        assertEquals(ZoneOffset.ofHours(2), overlap.getOffset());
    }

    @Test
    void earlyCompletionNeverCreatesOccurrenceBeforeCurrentDueDate() {
        Instant anchor = Instant.parse("2026-01-01T09:00:00Z");
        Instant now = anchor.minus(Duration.ofDays(2));
        assertEquals(anchor.plus(Duration.ofDays(7)), Recurrence.next(anchor, anchor, now, "weekly", 1, ROME));
    }

    @Test
    void impossibleCalendarAndInvalidIntervalsAreExplicitErrors() {
        Instant start = Instant.parse("2026-01-01T09:00:00Z");
        assertThrows(ApiException.class, () -> Recurrence.next(start, start, start, "daily", 0, ROME));
        assertThrows(ApiException.class, () -> Recurrence.next(start, start, start, "monthly", Integer.MAX_VALUE, ROME));
    }
}
