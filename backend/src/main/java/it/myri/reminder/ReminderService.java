package it.myri.reminder;

import it.myri.auth.AppUserRepository;
import java.time.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReminderService {
    private final JdbcTemplate jdbc;
    private final AppUserRepository users;
    private final CareerDueRepository careers;
    private final ReminderSettings settings;
    private final Clock clock;
    private final ZoneId zone;

    public ReminderService(JdbcTemplate jdbc, AppUserRepository users, CareerDueRepository careers,
            ReminderSettings settings, Clock clock, ZoneId zone) {
        this.jdbc = jdbc; this.users = users; this.careers = careers;
        this.settings = settings; this.clock = clock; this.zone = zone;
    }

    @Transactional
    public void generate() {
        // The singleton lock serializes competing scheduler instances; UNIQUE remains
        // a second guard. Existing keys survive reading and archiving notifications.
        if (users.lockSingleton().isEmpty()) return;
        Instant now = clock.instant();
        Instant tomorrow = CalendarWindows.today(now, zone).to();
        LocalDateTime stamp = LocalDateTime.ofInstant(now, ZoneOffset.UTC);
        jdbc.update("""
            INSERT INTO notification(kind,deduplication_key,task_id,triggered_at,created_at,version)
            SELECT 'task_due',CONCAT('task:',t.id,':',DATE_FORMAT(t.due_at,'%Y-%m-%dT%H:%i:%s.%f')),
              t.id,?,?,0 FROM task t
            WHERE t.archived_at IS NULL AND t.status IN ('todo','in_progress') AND t.due_at<?
            AND NOT EXISTS (SELECT 1 FROM notification n WHERE n.deduplication_key=
              CONCAT('task:',t.id,':',DATE_FORMAT(t.due_at,'%Y-%m-%dT%H:%i:%s.%f')))
            """, stamp, stamp, LocalDateTime.ofInstant(tomorrow, ZoneOffset.UTC));
        long afterId = 0;
        while (true) {
            var batch = careers.batch(now, afterId);
            if (batch.isEmpty()) break;
            for (var c : batch) {
                if (!c.due(now, zone, settings.careerMonths())) continue;
                String key = "career:" + c.personId() + ":" + (c.talkId() == null ? c.hiredOn() : c.talkId());
                jdbc.update("""
                    INSERT INTO notification(kind,deduplication_key,person_id,triggered_at,created_at,version)
                    SELECT 'career_talk_due',?,?,?, ?,0 FROM DUAL
                    WHERE NOT EXISTS (SELECT 1 FROM notification WHERE deduplication_key=?)
                    """, key, c.personId(), stamp, stamp, key);
            }
            afterId = batch.getLast().personId();
        }
    }
}
