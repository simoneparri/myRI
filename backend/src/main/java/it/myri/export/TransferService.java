package it.myri.export;

import static it.myri.export.TransferMapper.require;

import it.myri.audit.AuditService;
import it.myri.auth.AppUserRepository;
import it.myri.careertalk.CareerTalkRepository;
import it.myri.common.ApiException;
import it.myri.contact.ContactRepository;
import it.myri.person.*;
import it.myri.project.ProjectRepository;
import it.myri.raiserequest.*;
import it.myri.salary.*;
import it.myri.task.*;
import java.time.Clock;
import java.util.*;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransferService {
    private final PersonExportService exports;
    private final PersonService people;
    private final PersonRepository persons;
    private final AppUserRepository users;
    private final ContactRepository contacts;
    private final ProjectRepository projects;
    private final CareerTalkRepository talks;
    private final SalaryRepository salaries;
    private final RaiseRequestRepository raises;
    private final TaskRepository tasks;
    private final TransferMapper mapper;
    private final AuditService audit;
    private final Clock clock;

    public TransferService(PersonExportService exports, PersonService people, PersonRepository persons,
            AppUserRepository users, ContactRepository contacts, ProjectRepository projects,
            CareerTalkRepository talks, SalaryRepository salaries, RaiseRequestRepository raises,
            TaskRepository tasks, TransferMapper mapper, AuditService audit, Clock clock) {
        this.exports = exports; this.people = people; this.persons = persons; this.users = users;
        this.contacts = contacts; this.projects = projects; this.talks = talks; this.salaries = salaries;
        this.raises = raises; this.tasks = tasks; this.mapper = mapper; this.audit = audit; this.clock = clock;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public TransferDtos.Bundle export(List<Long> ids) {
        mapper.valid(new TransferDtos.Selection(ids));
        require(new HashSet<>(ids).size() == ids.size());
        List<TransferDtos.Entry> entries = new ArrayList<>();
        for (Long id : ids) {
            var data = exports.snapshot(id);
            String managerName = null;
            if (data.person().managerId() != null) {
                var manager = people.get(data.person().managerId());
                managerName = manager.lastName + " " + manager.firstName;
                if (managerName.length() > 200 && !ids.contains(manager.id)) {
                    throw ApiException.invalid("Nome manager oltre 200 caratteri: includere anche il manager nell'export.");
                }
            }
            entries.add(new TransferDtos.Entry(data, managerName));
        }
        var bundle = new TransferDtos.Bundle("myri-transfer", 1, clock.instant(), entries);
        checkBundle(bundle);
        return bundle;
    }

    @Transactional
    public TransferDtos.Report importFile(TransferDtos.Bundle bundle) {
        checkBundle(bundle);
        // Shared with normal person writes: duplicate checks and inserts cannot race.
        users.lockSingleton().orElseThrow(ApiException::missing);
        Map<Long, Person> imported = new LinkedHashMap<>();
        Map<Long, TransferDtos.Entry> sources = new LinkedHashMap<>();
        List<TransferDtos.Result> results = new ArrayList<>();
        int skipped = 0;
        for (var entry : bundle.people()) {
            var p = entry.data().person();
            require(p.id() != null && p.id() > 0 && sources.putIfAbsent(p.id(), entry) == null);
            boolean rsno = p.rsnoAgresso() != null && persons.existsByRsnoAgresso(p.rsnoAgresso().strip());
            boolean mypad = p.mypadId() != null && persons.existsByMypadId(p.mypadId());
            if (rsno || mypad) {
                skipped++;
                results.add(new TransferDtos.Result(p.id(), null, "skipped",
                        rsno && mypad ? "rsno_agresso,mypad_id" : rsno ? "rsno_agresso" : "mypad_id"));
                continue;
            }
            Person row = people.importRecord(mapper.person(p));
            mapper.metadata(row, p.createdAt(), p.updatedAt(), p.archivedAt());
            imported.put(p.id(), row);
            importDetails(entry.data(), row.id);
            results.add(new TransferDtos.Result(p.id(), row.id, "imported", null));
        }
        for (var source : imported.entrySet()) {
            var entry = sources.get(source.getKey());
            var oldManager = entry.data().person().managerId();
            if (oldManager == null) continue;
            require(oldManager > 0 && !oldManager.equals(source.getKey()));
            Person manager = imported.get(oldManager);
            Person row = source.getValue();
            if (manager != null) {
                Set<Long> visited = new HashSet<>();
                Long cursor = source.getKey();
                while (cursor != null && imported.containsKey(cursor)) {
                    require(visited.add(cursor));
                    cursor = sources.get(cursor).data().person().managerId();
                }
                row.managerId = manager.id;
            } else {
                require(entry.managerName() != null && !entry.managerName().isBlank()
                        && entry.managerName().length() <= 200);
                row.externalManager = entry.managerName();
            }
        }
        persons.flush();
        return new TransferDtos.Report(imported.size(), skipped, List.copyOf(results));
    }

    private void importDetails(PersonExportService.Snapshot s, Long personId) {
        Long oldPersonId = s.person().id();
        var contactRows = index(s.contacts(), it.myri.contact.ContactDtos.View::id);
        contactRows.values().forEach(v -> {
            require(oldPersonId.equals(v.personId()));
            contacts.saveAndFlush(mapper.contact(v, personId));
        });
        var projectRows = index(s.projects(), it.myri.project.ProjectDtos.View::id);
        projectRows.values().forEach(v -> {
            require(oldPersonId.equals(v.personId()));
            projects.saveAndFlush(mapper.project(v, personId));
        });
        Map<Long, Long> talkIds = new HashMap<>();
        index(s.careerTalks(), it.myri.careertalk.CareerTalkDtos.View::id).forEach((id, v) -> {
            require(oldPersonId.equals(v.personId()));
            talkIds.put(id, talks.saveAndFlush(mapper.talk(v, personId)).id);
        });
        var salaryRows = index(s.salaries(), SalaryDtos.View::id);
        var raiseRows = index(s.raiseRequests(), RaiseDtos.View::id);
        Map<Long, Salary> salaryIds = new HashMap<>();
        Map<Long, RaiseRequest> raiseIds = new HashMap<>();
        // Insert the financial dependency graph in order, never UPDATE an immutable salary.
        while (salaryIds.size() < salaryRows.size() || raiseIds.size() < raiseRows.size()) {
            int before = salaryIds.size() + raiseIds.size();
            for (var v : salaryRows.values()) {
                if (salaryIds.containsKey(v.id())) continue;
                require(oldPersonId.equals(v.personId()));
                Long sourceId = v.sourceRaiseRequestId();
                if (sourceId != null && !raiseIds.containsKey(sourceId)) continue;
                var row = mapper.salary(v, personId, sourceId == null ? null : raiseIds.get(sourceId).id);
                if (sourceId != null) {
                    var source = raiseRows.get(sourceId);
                    require("approved".equals(source.status()) && Objects.equals(source.salaryId(), v.id()));
                    var base = salaryIds.get(source.baseSalaryId());
                    var target = RaiseService.target(base.amount, source.requestedSalary(), source.requestedPercentage());
                    require(target.compareTo(row.amount) == 0 && base.currency.equals(row.currency));
                }
                salaries.saveAndFlush(row);
                salaryIds.put(v.id(), row);
                audit.record(personId, row.id, null, "salary_created", "transfer");
            }
            for (var v : raiseRows.values()) {
                if (raiseIds.containsKey(v.id()) || !salaryIds.containsKey(v.baseSalaryId())) continue;
                require(oldPersonId.equals(v.personId()));
                var row = mapper.raise(v, personId, salaryIds.get(v.baseSalaryId()));
                raises.saveAndFlush(row);
                raiseIds.put(v.id(), row);
                audit.record(personId, null, row.id, "raise_created", "transfer");
            }
            require(salaryIds.size() + raiseIds.size() > before);
        }
        for (var v : raiseRows.values()) {
            if (v.salaryId() != null) {
                var generated = salaryRows.get(v.salaryId());
                require(generated != null && Objects.equals(generated.sourceRaiseRequestId(), v.id()));
            }
        }
        var taskRows = index(s.tasks(), TaskDtos.View::id);
        Map<Long, Task> taskIds = new HashMap<>();
        for (var v : taskRows.values()) {
            require(oldPersonId.equals(v.personId()));
            Long talkId = mapped(talkIds, v.careerTalkId());
            Long raiseId = v.raiseRequestId() == null ? null : required(raiseIds, v.raiseRequestId()).id;
            var row = mapper.task(v, personId, talkId, raiseId);
            tasks.saveAndFlush(row);
            taskIds.put(v.id(), row);
        }
        Set<Long> predecessors = new HashSet<>();
        for (var v : taskRows.values()) {
            if (v.sourceTaskId() == null) continue;
            require(predecessors.add(v.sourceTaskId()));
            Set<Long> visited = new HashSet<>();
            Long cursor = v.id();
            while (cursor != null) {
                require(visited.add(cursor));
                cursor = required(taskRows, cursor).sourceTaskId();
            }
            var previous = required(taskRows, v.sourceTaskId());
            require("done".equals(previous.status()) && previous.recurrenceFrequency() != null);
            taskIds.get(v.id()).sourceTaskId = required(taskIds, v.sourceTaskId()).id;
        }
        tasks.flush();
    }

    private static void checkBundle(TransferDtos.Bundle bundle) {
        require(bundle != null && "myri-transfer".equals(bundle.format()) && bundle.schemaVersion() == 1
                && bundle.people() != null && !bundle.people().isEmpty()
                && bundle.people().size() <= TransferDtos.MAX_PEOPLE);
        int count = 0;
        for (var entry : bundle.people()) {
            require(entry != null && entry.data() != null && entry.data().schemaVersion() == 1
                    && entry.data().person() != null);
            var s = entry.data();
            count += 1 + size(s.contacts()) + size(s.projects()) + size(s.salaries())
                    + size(s.raiseRequests()) + size(s.careerTalks()) + size(s.tasks());
            if (count > TransferDtos.MAX_RECORDS) {
                throw ApiException.invalid("Trasferimento oltre il limite di 10000 record. Ridurre la selezione, nessun dato e stato troncato.");
            }
        }
    }

    private static int size(List<?> rows) {
        require(rows != null);
        return rows.size();
    }

    private static <T> Map<Long, T> index(List<T> rows, Function<T, Long> id) {
        Map<Long, T> result = new LinkedHashMap<>();
        for (T row : rows) {
            require(row != null);
            Long key = id.apply(row);
            require(key != null && key > 0 && result.putIfAbsent(key, row) == null);
        }
        return result;
    }

    private static <T> T required(Map<Long, T> map, Long id) {
        T value = map.get(id);
        require(value != null);
        return value;
    }

    private static Long mapped(Map<Long, Long> map, Long id) {
        return id == null ? null : required(map, id);
    }
}
