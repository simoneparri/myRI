package it.myri.reminder;

import java.time.*;

public final class CalendarWindows {
    private CalendarWindows() {}
    public record Window(Instant from, Instant to) {}
    public static Window today(Instant now, ZoneId zone) {
        LocalDate day = now.atZone(zone).toLocalDate();
        return new Window(day.atStartOfDay(zone).toInstant(), day.plusDays(1).atStartOfDay(zone).toInstant());
    }
    public static Window nextSeven(Instant now, ZoneId zone) {
        LocalDate day = now.atZone(zone).toLocalDate();
        return new Window(day.plusDays(1).atStartOfDay(zone).toInstant(), day.plusDays(8).atStartOfDay(zone).toInstant());
    }
}
