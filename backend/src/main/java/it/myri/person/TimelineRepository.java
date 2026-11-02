package it.myri.person;

import it.myri.common.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TimelineRepository {
    private static final String EVENTS = """
            SELECT 'salary' AS kind, id, CAST(effective_on AS DATETIME) AS sort_at,
                   effective_on AS event_date, created_at, 'Variazione RAL' AS title,
                   amount, currency, NULL AS status, NULL AS archived_at
            FROM salary WHERE person_id = :personId
            UNION ALL
            SELECT 'raise_request', id, CAST(requested_on AS DATETIME), requested_on,
                   created_at, 'Richiesta aumento', requested_salary, currency, status, archived_at
            FROM raise_request WHERE person_id = :personId
            UNION ALL
            SELECT 'career_talk', id, held_at, NULL, created_at, 'Career talk',
                   NULL, NULL, NULL, archived_at
            FROM career_talk WHERE person_id = :personId
            UNION ALL
            SELECT 'task', id, COALESCE(due_at, created_at), NULL, created_at, title,
                   NULL, NULL, status, archived_at
            FROM task WHERE person_id = :personId
            """;

    public record Event(String kind, Long id, Instant sortAt, LocalDate eventDate,
            Instant createdAt, String title, BigDecimal amount, String currency, String status, boolean archived) {}

    private final NamedParameterJdbcTemplate jdbc;
    public TimelineRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public PageResponse<Event> list(Long personId, Set<String> kinds, boolean includeArchived, int page, int size) {
        Queries.page(page, size, "id,asc", Set.of("id"));
        if (kinds == null || kinds.isEmpty()) {
            kinds = Set.of("salary", "raise_request", "career_talk", "task");
        }
        if (!Set.of("salary", "raise_request", "career_talk", "task").containsAll(kinds)) {
            throw ApiException.invalid("Tipo evento timeline non valido.");
        }
        var parameters = new MapSqlParameterSource().addValue("personId", personId)
                .addValue("kinds", kinds).addValue("limit", size).addValue("offset", (long) page * size);
        String selection = " FROM (" + EVENTS + ") events WHERE kind IN (:kinds)"
                + (includeArchived ? "" : " AND archived_at IS NULL");
        Long count = jdbc.queryForObject("SELECT COUNT(*)" + selection, parameters, Long.class);
        List<Event> events = jdbc.query("SELECT *" + selection
                + " ORDER BY sort_at DESC, kind ASC, id DESC LIMIT :limit OFFSET :offset",
                parameters, (rs, row) -> new Event(rs.getString("kind"), rs.getLong("id"),
                        rs.getObject("sort_at", java.time.LocalDateTime.class).toInstant(java.time.ZoneOffset.UTC),
                        rs.getObject("event_date", LocalDate.class),
                        rs.getObject("created_at", java.time.LocalDateTime.class).toInstant(java.time.ZoneOffset.UTC),
                        rs.getString("title"), rs.getBigDecimal("amount"), rs.getString("currency"),
                        rs.getString("status"), rs.getTimestamp("archived_at") != null));
        long total = Objects.requireNonNull(count);
        return new PageResponse<>(events, page, size, total, (int) ((total + size - 1) / size));
    }
}
