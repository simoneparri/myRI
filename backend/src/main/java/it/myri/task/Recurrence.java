package it.myri.task;

import it.myri.common.ApiException;
import java.time.*;
import java.time.temporal.ChronoUnit;

public final class Recurrence {
    private Recurrence() {}

    public static Instant next(Instant anchor, Instant due, Instant now, String frequency,
            int interval, ZoneId zone) {
        if (interval <= 0) { throw ApiException.invalid("Intervallo ricorrenza non valido."); }
        ZonedDateTime start = anchor.atZone(zone);
        Instant cutoff = now.isAfter(due) ? now : due;
        ZonedDateTime end = cutoff.atZone(zone);
        long elapsed = switch (frequency) {
            case "daily" -> ChronoUnit.DAYS.between(start.toLocalDate(), end.toLocalDate());
            case "weekly" -> ChronoUnit.WEEKS.between(start.toLocalDate(), end.toLocalDate());
            case "monthly" -> ChronoUnit.MONTHS.between(YearMonth.from(start), YearMonth.from(end));
            default -> throw ApiException.invalid("Frequenza ricorrenza non valida.");
        };
        try {
            long periods = Math.max(1, Math.floorDiv(elapsed, interval));
            ZonedDateTime candidate = advance(start, frequency, Math.multiplyExact(periods, interval));
            if (!candidate.toInstant().isAfter(cutoff)) {
                candidate = advance(start, frequency, Math.multiplyExact(periods + 1, interval));
            }
            if (candidate.getYear() > 9999) {
                throw ApiException.invalid("La prossima scadenza supera il limite del calendario.");
            }
            return candidate.toInstant();
        } catch (DateTimeException | ArithmeticException exception) {
            throw ApiException.invalid("La ricorrenza supera il limite del calendario.");
        }
    }

    private static ZonedDateTime advance(ZonedDateTime start, String frequency, long periods) {
        return switch (frequency) {
            case "daily" -> start.plusDays(periods);
            case "weekly" -> start.plusWeeks(periods);
            case "monthly" -> start.plusMonths(periods);
            default -> throw ApiException.invalid("Frequenza ricorrenza non valida.");
        };
    }
}
