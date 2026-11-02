package it.myri.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

public final class Dates {
    private Dates() {}

    public static void check(LocalDate value) {
        if (value != null && (value.getYear() < 1000 || value.getYear() > 9999)) {
            throw ApiException.invalid("Data fuori dall'intervallo supportato (1000-9999).");
        }
    }

    public static void check(Instant value) {
        if (value != null) { check(value.atOffset(ZoneOffset.UTC).toLocalDate()); }
    }
}
