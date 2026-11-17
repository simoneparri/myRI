package it.myri.export;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class TransferDtos {
    private TransferDtos() {}
    public static final int MAX_PEOPLE = 100;
    public static final int MAX_RECORDS = 10000;
    public static final int MAX_BYTES = 10 * 1024 * 1024;
    public record Selection(@NotEmpty @Size(max = MAX_PEOPLE) List<@NotNull @Positive Long> personIds) {}
    public record Entry(PersonExportService.Snapshot data, String managerName) {}
    public record Bundle(String format, int schemaVersion, Instant exportedAt, List<Entry> people) {}
    public record Result(Long sourceId, Long personId, String status, String reason) {}
    public record Report(int imported, int skipped, List<Result> results) {}
}
