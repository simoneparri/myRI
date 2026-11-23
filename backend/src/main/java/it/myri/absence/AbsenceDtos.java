package it.myri.absence;

import java.time.LocalDateTime;
import java.util.List;

public final class AbsenceDtos {
    private AbsenceDtos() {}

    public record View(String id, String personId, String firstName, String lastName,
            LocalDateTime startsAt, LocalDateTime endsAt, String code, String label, String status,
            String days, String hours, String importedToTimesheet) {}
    public record RowError(long row, String reason) {}
    public record ImportReport(int imported, int unchanged, int skipped, int replaced,
            List<RowError> errors) {}
}
