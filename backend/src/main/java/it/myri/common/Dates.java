package it.myri.common;

import java.time.Instant;
import java.time.LocalDate;

public final class Dates {
    private static final Instant MIN = Instant.parse("1000-01-01T00:00:00Z");
    private static final Instant MAX = Instant.parse("9999-12-31T23:59:59.999999Z");

    private Dates() {}

    public static void check(LocalDate value) {
        if (value != null && (value.getYear() < 1000 || value.getYear() > 9999)) {
            throw ApiException.invalid("Data fuori dall'intervallo supportato (1000-9999).");
        }
    }

    public static void check(Instant value) {
        if (value != null && (value.isBefore(MIN) || value.isAfter(MAX))) {
            throw ApiException.invalid("Data fuori dall'intervallo supportato (1000-9999).");
        }
    }
}
