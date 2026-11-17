package it.myri.export;

import it.myri.careertalk.*;
import it.myri.common.*;
import it.myri.contact.*;
import it.myri.person.*;
import it.myri.project.*;
import it.myri.raiserequest.*;
import it.myri.salary.*;
import it.myri.task.*;
import jakarta.validation.Validator;
import java.time.*;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class TransferMapper {
    private final Validator validator;
    private final Clock clock;
    private final ZoneId zone;

    public TransferMapper(Validator validator, Clock clock, ZoneId zone) {
        this.validator = validator;
        this.clock = clock;
        this.zone = zone;
    }

    public PersonDtos.Input person(PersonDtos.View p) {
        var input = new PersonDtos.Input(p.firstName(), p.lastName(), p.email(), p.phone(), p.role(),
                p.hiredOn(), p.hiringLocation(), p.residence(), null, p.externalManager(), p.notes(),
                p.status(), null, p.careerStartedOn(), p.seniorityLevel(), p.mypadId(), p.frameworks(),
                p.bornOn(), p.rsnoAgresso(), p.insideId(), p.education(), p.capacityManagement());
        valid(input);
        require(p.managerId() == null || p.externalManager() == null);
        return input;
    }

    public Contact contact(ContactDtos.View v, Long personId) {
        var input = new ContactDtos.Input(v.type(), v.value(), v.notes(), null, v.contactedOn());
        valid(input);
        Contact row = new Contact();
        row.personId = personId;
        ContactDtos.apply(row, input);
        metadata(row, v.createdAt(), v.updatedAt(), v.archivedAt());
        return row;
    }

    public Project project(ProjectDtos.View v, Long personId) {
        var input = new ProjectDtos.Input(v.client(), v.startsOn(), v.endsOn(), v.businessManager(),
                v.workMode(), v.notes(), null);
        valid(input);
        Dates.check(v.startsOn());
        Dates.check(v.endsOn());
        require(v.startsOn() == null || v.endsOn() == null || !v.startsOn().isAfter(v.endsOn()));
        Project row = new Project();
        row.personId = personId;
        ProjectDtos.apply(row, input);
        metadata(row, v.createdAt(), v.updatedAt(), v.archivedAt());
        return row;
    }

    public CareerTalk talk(CareerTalkDtos.View v, Long personId) {
        var input = new CareerTalkDtos.Input(personId, v.heldAt(), v.topics(), v.agreedGoals(),
                v.feedbackGiven(), v.feedbackReceived(), v.nextSteps(), v.suggestedNextOn(), null);
        valid(input);
        Dates.check(v.heldAt());
        Dates.check(v.suggestedNextOn());
        CareerTalk row = new CareerTalk();
        CareerTalkDtos.apply(row, input);
        metadata(row, v.createdAt(), v.updatedAt(), v.archivedAt());
        return row;
    }

    public Salary salary(SalaryDtos.View v, Long personId, Long sourceRaiseId) {
        // Historical exports can legitimately lack employment metadata required on new entries.
        var input = new SalaryDtos.Input(v.amount(), v.currency(), v.effectiveOn(),
                v.contractType(), v.weeklyHours(), v.classificationLevel(), v.reason(), "transfer",
                v.mealVouchers(), v.bonusLetterAmount(), v.companyCar());
        var legacyNulls = new java.util.HashSet<String>();
        if (v.contractType() == null) legacyNulls.add("contractType");
        if (v.weeklyHours() == null) legacyNulls.add("weeklyHours");
        if (v.classificationLevel() == null) legacyNulls.add("classificationLevel");
        require(validator.validate(input).stream()
                .allMatch(error -> legacyNulls.contains(error.getPropertyPath().toString())));
        SalaryService.currency(v.currency());
        Dates.check(v.effectiveOn());
        Dates.check(v.createdAt());
        require(v.createdAt() != null);
        Salary row = new Salary();
        row.personId = personId;
        row.amount = v.amount();
        row.currency = v.currency();
        row.effectiveOn = v.effectiveOn();
        row.contractType = v.contractType();
        row.weeklyHours = v.weeklyHours();
        row.classificationLevel = v.classificationLevel();
        row.reason = v.reason();
        row.mealVouchers = v.mealVouchers();
        row.bonusLetterAmount = v.bonusLetterAmount();
        row.companyCar = v.companyCar();
        row.sourceRaiseRequestId = sourceRaiseId;
        row.createdAt = v.createdAt();
        return row;
    }

    public RaiseRequest raise(RaiseDtos.View v, Long personId, Salary base) {
        var input = new RaiseDtos.Input(personId, base.id, v.requestedOn(), v.requestedSalary(),
                v.requestedPercentage(), v.motivation(), null, v.benefits());
        valid(input);
        require(v.status() != null && RaiseService.STATES.contains(v.status()));
        require(base.currency.equals(v.currency()) && !base.effectiveOn.isAfter(v.requestedOn()));
        RaiseService.target(base.amount, v.requestedSalary(), v.requestedPercentage());
        Dates.check(v.requestedOn());
        Dates.check(v.outcomeOn());
        boolean decided = Set.of("approved", "rejected", "postponed").contains(v.status());
        require(decided == (v.outcomeOn() != null));
        if (decided) require(!v.outcomeOn().isBefore(v.requestedOn()));
        require(v.outcomeNotes() == null || v.outcomeNotes().length() <= 10000);
        RaiseRequest row = new RaiseRequest();
        RaiseDtos.apply(row, input);
        row.currency = base.currency;
        row.status = v.status();
        row.outcomeOn = v.outcomeOn();
        row.outcomeNotes = v.outcomeNotes();
        metadata(row, v.createdAt(), v.updatedAt(), v.archivedAt());
        return row;
    }

    public Task task(TaskDtos.View v, Long personId, Long talkId, Long raiseId) {
        require(v.status() != null && Set.of("todo", "in_progress", "done", "cancelled").contains(v.status()));
        var input = new TaskDtos.Input(v.title(), v.description(), v.dueAt(), v.priority(),
                "todo", personId, talkId, raiseId, v.recurrenceFrequency(), v.recurrenceInterval(), null);
        valid(input);
        require("done".equals(v.status()) == (v.completedAt() != null));
        require((v.recurrenceFrequency() == null) == (v.recurrenceInterval() == null));
        Dates.check(v.dueAt());
        Dates.check(v.completedAt());
        if (v.recurrenceFrequency() != null) {
            require(v.dueAt() != null);
            Recurrence.next(v.dueAt(), v.dueAt(), clock.instant(), v.recurrenceFrequency(),
                    v.recurrenceInterval(), zone);
        }
        Task row = new Task();
        TaskDtos.apply(row, input);
        row.status = v.status();
        row.completedAt = v.completedAt();
        metadata(row, v.createdAt(), v.updatedAt(), v.archivedAt());
        return row;
    }

    public void metadata(MutableEntity row, Instant createdAt, Instant updatedAt, Instant archivedAt) {
        require(createdAt != null && updatedAt != null);
        Dates.check(createdAt);
        Dates.check(updatedAt);
        Dates.check(archivedAt);
        row.createdAt = createdAt;
        row.updatedAt = updatedAt;
        row.archivedAt = archivedAt;
    }

    public void valid(Object input) {
        require(input != null && validator.validate(input).isEmpty());
    }

    public static void require(boolean condition) {
        if (!condition) throw ApiException.invalid("File di trasferimento non valido: dati o collegamenti incoerenti. Nessuna persona importata.");
    }
}
