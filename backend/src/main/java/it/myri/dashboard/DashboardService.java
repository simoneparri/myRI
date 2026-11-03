package it.myri.dashboard;

import it.myri.common.*;
import it.myri.person.PersonService;
import it.myri.reminder.*;
import it.myri.salary.SalaryDtos;
import it.myri.salary.SalaryRepository;
import it.myri.task.*;
import java.time.*;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

@Service
@Transactional(readOnly = true)
public class DashboardService {
    private final TodoService todos;
    private final CareerDueRepository careers;
    private final ReminderSettings settings;
    private final SalaryRepository salaries;
    private final PersonService people;
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final ZoneId zone;
    public DashboardService(TodoService todos, CareerDueRepository careers, ReminderSettings settings,
            SalaryRepository salaries, PersonService people, JdbcTemplate jdbc, Clock clock, ZoneId zone) {
        this.todos = todos; this.careers = careers; this.settings = settings;
        this.salaries = salaries; this.people = people; this.jdbc = jdbc; this.clock = clock; this.zone = zone;
    }
    public record Summary(Instant asOf, String timezone, int careerMonths, long todayTasks,
            long overdueTasks, long nextSevenTasks, long peopleWithoutRecentTalk,
            long openRaiseRequests, long unreadNotifications) {}
    public Summary summary() {
        Instant now = clock.instant();
        return new Summary(now, zone.getId(), settings.careerMonths(),
                todos.count("today", now), todos.count("overdue", now),
                todos.count("next7", now), careers.list(now, zone, settings.careerMonths(), 0, 1).totalElements(),
                jdbc.queryForObject("SELECT COUNT(*) FROM raise_request WHERE archived_at IS NULL AND status IN ('draft','submitted','postponed')", Long.class),
                jdbc.queryForObject("SELECT COUNT(*) FROM notification WHERE archived_at IS NULL AND read_at IS NULL", Long.class));
    }
    public PageResponse<CareerDueRepository.View> careerDue(int page, int size) {
        return careers.list(clock.instant(), zone, settings.careerMonths(), page, size);
    }
    public PageResponse<SalaryDtos.View> trend(Long personId, int page, int size) {
        people.get(personId);
        Specification<it.myri.salary.Salary> spec = Queries.equal("personId", personId);
        return PageResponse.of(salaries.findAll(spec, Queries.page(page, size, "effectiveOn,asc", Set.of("effectiveOn"))), SalaryDtos::view);
    }
}
