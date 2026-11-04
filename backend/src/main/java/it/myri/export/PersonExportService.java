package it.myri.export;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import it.myri.common.*;
import it.myri.person.*;
import it.myri.contact.*;
import it.myri.salary.*;
import it.myri.raiserequest.*;
import it.myri.careertalk.*;
import it.myri.task.*;
import it.myri.project.*;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PersonExportService {
    private static final int MAX_RECORDS = 1000;
    private final PersonService people;
    private final ContactRepository contacts;
    private final SalaryRepository salaries;
    private final RaiseRequestRepository raises;
    private final CareerTalkRepository talks;
    private final TaskRepository tasks;
    private final ProjectRepository projects;
    private final ProjectService projectService;
    private final Clock clock;
    private final ObjectMapper json;
    public PersonExportService(PersonService people, ContactRepository contacts, SalaryRepository salaries,
            RaiseRequestRepository raises, CareerTalkRepository talks, TaskRepository tasks, Clock clock, ObjectMapper json,
            ProjectRepository projects, ProjectService projectService) {
        this.people = people; this.contacts = contacts; this.salaries = salaries;
        this.raises = raises; this.talks = talks; this.tasks = tasks; this.clock = clock; this.json = json;
        this.projects = projects; this.projectService = projectService;
    }
    public record Snapshot(int schemaVersion, Instant exportedAt, PersonDtos.View person,
            List<ContactDtos.View> contacts, List<SalaryDtos.View> salaries, List<RaiseDtos.View> raiseRequests,
            List<CareerTalkDtos.View> careerTalks, List<TaskDtos.View> tasks, List<ProjectDtos.View> projects) {}

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Snapshot snapshot(Long personId) {
        var person = people.view(people.get(personId));
        var salaryRows = rows(salaries, personId, SalaryDtos::view);
        Map<Long, Long> generated = new HashMap<>();
        salaryRows.stream().filter(s -> s.sourceRaiseRequestId() != null).forEach(s -> generated.put(s.sourceRaiseRequestId(), s.id()));
        var result = new Snapshot(1, clock.instant(), person, rows(contacts, personId, ContactDtos::view), salaryRows,
                rows(raises, personId, r -> RaiseDtos.view(r, generated.get(r.id))),
                rows(talks, personId, CareerTalkDtos::view), rows(tasks, personId, TaskDtos::view),
                rows(projects, personId, projectService::view));
        int count = 1 + result.contacts().size() + result.salaries().size() + result.raiseRequests().size()
                + result.careerTalks().size() + result.tasks().size() + result.projects().size();
        if (count > MAX_RECORDS) throw tooLarge();
        return result;
    }
    private <T, V> List<V> rows(JpaSpecificationExecutor<T> repository, Long personId, Function<T, V> mapper) {
        var page = repository.findAll(Queries.equal("personId", personId), PageRequest.of(0, MAX_RECORDS, Sort.by("id")));
        if (page.getTotalElements() > MAX_RECORDS) throw tooLarge();
        return page.stream().map(mapper).toList();
    }
    private static ApiException tooLarge() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Export persona oltre il limite di 1000 record. Utilizzare il backup completo, nessun dato e stato troncato.");
    }

    public String csv(Snapshot snapshot) {
        LinkedHashMap<String, List<JsonNode>> groups = new LinkedHashMap<>();
        groups.put("person", List.of(json.valueToTree(snapshot.person())));
        groups.put("contact", snapshot.contacts().stream().map(json::<JsonNode>valueToTree).toList());
        groups.put("salary", snapshot.salaries().stream().map(json::<JsonNode>valueToTree).toList());
        groups.put("raise_request", snapshot.raiseRequests().stream().map(json::<JsonNode>valueToTree).toList());
        groups.put("career_talk", snapshot.careerTalks().stream().map(json::<JsonNode>valueToTree).toList());
        groups.put("task", snapshot.tasks().stream().map(json::<JsonNode>valueToTree).toList());
        groups.put("project", snapshot.projects().stream().map(json::<JsonNode>valueToTree).toList());
        LinkedHashSet<String> fields = new LinkedHashSet<>();
        groups.values().forEach(list -> list.forEach(row -> row.fieldNames().forEachRemaining(fields::add)));
        StringBuilder csv = new StringBuilder();
        csv.append("recordType,schemaVersion,exportedAt");
        fields.forEach(field -> csv.append(',').append(cell(field)));
        csv.append("\r\n");
        groups.forEach((kind, list) -> list.forEach(row -> {
            csv.append(cell(kind)).append(",1,").append(cell(snapshot.exportedAt().toString()));
            fields.forEach(field -> csv.append(',').append(cell(row.hasNonNull(field) ? csvValue(row.get(field)) : "")));
            csv.append("\r\n");
        }));
        return csv.toString();
    }
    private static String csvValue(JsonNode value) {
        if (!value.isArray()) return value.asText();
        StringJoiner items = new StringJoiner(", ");
        value.forEach(item -> items.add(item.asText()));
        return items.toString();
    }
    public static String cell(String value) {
        // Quoting alone does not stop spreadsheet formulas, including whitespace-prefixed formulas.
        String probe = value.stripLeading();
        if (!probe.isEmpty() && "=+-@".indexOf(probe.charAt(0)) >= 0
                || !value.isEmpty() && (value.charAt(0) == '\t' || value.charAt(0) == '\r' || value.charAt(0) == '\n')) {
            value = "'" + value;
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
