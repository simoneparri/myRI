package it.myri.project;

import it.myri.common.*;
import it.myri.person.PersonService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ProjectService {
    private final ProjectRepository projects;
    private final PersonService people;
    private final Clock clock;
    private final ZoneId zone;

    public ProjectService(ProjectRepository projects, PersonService people, Clock clock, ZoneId zone) {
        this.projects = projects;
        this.people = people;
        this.clock = clock;
        this.zone = zone;
    }

    @Transactional(readOnly = true)
    public PageResponse<ProjectDtos.View> list(Long personId, String q, String period, boolean includeArchived,
            int page, int size, String sort) {
        people.get(personId);
        Queries.value(period, Set.of("current", "past", "upcoming"));
        LocalDate today = LocalDate.now(clock.withZone(zone));
        return PageResponse.of(projects.findAll(Queries.<Project>visible(includeArchived)
                .and(Queries.equal("personId", personId))
                .and((root, query, cb) -> {
                    if (period == null) return cb.conjunction();
                    var starts = root.<LocalDate>get("startsOn");
                    var ends = root.<LocalDate>get("endsOn");
                    return cb.and(cb.isNull(root.get("archivedAt")), switch (period) {
                        case "past" -> cb.lessThan(ends, today);
                        case "upcoming" -> cb.greaterThan(starts, today);
                        default -> cb.and(
                                cb.or(cb.isNull(starts), cb.lessThanOrEqualTo(starts, today)),
                                cb.or(cb.isNull(ends), cb.greaterThanOrEqualTo(ends, today)));
                    });
                })
                .and(Queries.text(q, "client", "businessManager", "notes")),
                Queries.page(page, size, sort, Set.of("id", "client", "startsOn", "endsOn", "createdAt"))),
                project -> ProjectDtos.view(project, today));
    }

    @Transactional(readOnly = true)
    public Project get(Long id) {
        return projects.findById(id).orElseThrow(ApiException::missing);
    }

    public ProjectDtos.View view(Project project) {
        return ProjectDtos.view(project, LocalDate.now(clock.withZone(zone)));
    }

    public ProjectDtos.View create(Long personId, ProjectDtos.Input input) {
        people.requireUsable(personId);
        validate(input);
        Project project = new Project();
        project.personId = personId;
        project.initialize(clock);
        ProjectDtos.apply(project, input);
        return view(projects.saveAndFlush(project));
    }

    public ProjectDtos.View update(Long id, ProjectDtos.Input input) {
        Project project = get(id);
        people.requireUsable(project.personId);
        Queries.editable(project);
        Queries.version(project, input.version());
        validate(input);
        ProjectDtos.apply(project, input);
        project.touch(clock);
        return view(projects.saveAndFlush(project));
    }

    public ProjectDtos.View archive(Long id, Long version) {
        Project project = get(id);
        project.archive(version, clock);
        return view(projects.saveAndFlush(project));
    }

    private static void validate(ProjectDtos.Input input) {
        Dates.check(input.startsOn());
        Dates.check(input.endsOn());
        if (input.startsOn() != null && input.endsOn() != null && input.startsOn().isAfter(input.endsOn())) {
            throw ApiException.invalid("La data di fine progetto non puo precedere quella di inizio.");
        }
        Queries.value(input.workMode(), Set.of("onsite", "remote", "hybrid"));
    }
}
