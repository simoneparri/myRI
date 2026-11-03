package it.myri.reminder;

import it.myri.common.PageResponse;
import it.myri.common.Queries;
import java.time.*;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CareerDueRepository {
    private final JdbcTemplate jdbc;
    public CareerDueRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record View(Long personId, String firstName, String lastName, LocalDate referenceOn,
            LocalDate dueAfter, Long lastTalkId) {}

    // Future and archived meetings cannot reset the last-held-meeting baseline.
    private static final String BASE = """
        FROM person p LEFT JOIN career_talk t ON t.id = (
          SELECT c.id FROM career_talk c WHERE c.person_id=p.id AND c.archived_at IS NULL
          AND c.held_at<=? ORDER BY c.held_at DESC,c.id DESC LIMIT 1)
        WHERE p.status='active' AND p.archived_at IS NULL
        AND p.id>? ORDER BY p.id LIMIT 100
        """;

    public record Candidate(Long personId, String firstName, String lastName,
            LocalDate hiredOn, Long talkId, Instant heldAt) {
        public LocalDate reference(ZoneId zone) { return heldAt == null ? hiredOn : heldAt.atZone(zone).toLocalDate(); }
        public boolean due(Instant now, ZoneId zone, int months) {
            return now.atZone(zone).toLocalDate().isAfter(reference(zone).plusMonths(months));
        }
    }

    public List<Candidate> batch(Instant now, long afterId) {
        return jdbc.query("SELECT p.id,p.first_name,p.last_name,p.hired_on,t.id talk_id,t.held_at " + BASE,
                (rs, row) -> new Candidate(rs.getLong("id"), rs.getString("first_name"), rs.getString("last_name"),
                        rs.getObject("hired_on", LocalDate.class), rs.getObject("talk_id", Long.class),
                        rs.getObject("held_at", LocalDateTime.class) == null ? null
                                : rs.getObject("held_at", LocalDateTime.class).toInstant(ZoneOffset.UTC)),
                LocalDateTime.ofInstant(now, ZoneOffset.UTC), afterId);
    }

    public PageResponse<View> list(Instant now, ZoneId zone, int months, int page, int size) {
        Queries.page(page, size, "id,asc", Set.of("id"));
        List<View> items = new ArrayList<>();
        long total = 0, afterId = 0, offset = (long) page * size;
        while (true) {
            var batch = batch(now, afterId);
            if (batch.isEmpty()) break;
            for (Candidate c : batch) {
                if (c.due(now, zone, months)) {
                    if (total >= offset && items.size() < size) {
                        LocalDate reference = c.reference(zone);
                        items.add(new View(c.personId(), c.firstName(), c.lastName(), reference,
                                reference.plusMonths(months), c.talkId()));
                    }
                    total++;
                }
            }
            afterId = batch.getLast().personId();
        }
        return new PageResponse<>(items, page, size, total, (int) ((total + size - 1) / size));
    }
}
