package it.myri.raiserequest;

import it.myri.audit.AuditService;
import it.myri.common.*;
import it.myri.person.PersonService;
import it.myri.salary.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class RaiseService {
    public static final Set<String> STATES = Set.of("draft", "submitted", "approved", "rejected", "postponed");
    private final RaiseRequestRepository requests;
    private final SalaryRepository salaries;
    private final SalaryService salaryService;
    private final PersonService people;
    private final AuditService audit;
    private final Clock clock;

    public RaiseService(RaiseRequestRepository requests, SalaryRepository salaries, SalaryService salaryService,
            PersonService people, AuditService audit, Clock clock) {
        this.requests = requests;
        this.salaries = salaries;
        this.salaryService = salaryService;
        this.people = people;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public RaiseRequest get(Long id) { return requests.findById(id).orElseThrow(ApiException::missing); }

    @Transactional(readOnly = true)
    public RaiseDtos.View detail(Long id) { return view(get(id)); }

    @Transactional(readOnly = true)
    public PageResponse<RaiseDtos.View> list(Long personId, String q, String status, boolean includeArchived,
            int page, int size, String sort) {
        Queries.value(status, STATES);
        var result = requests.findAll(Queries.<RaiseRequest>visible(includeArchived)
                .and(Queries.equal("personId", personId)).and(Queries.equal("status", status))
                .and(Queries.text(q, "motivation")),
                Queries.page(page, size, sort, Set.of("id", "requestedOn", "status", "createdAt")));
        var generated = result.isEmpty() ? java.util.Map.<Long, Long>of()
                : salaries.findBySourceRaiseRequestIdIn(result.stream().map(r -> r.id).toList())
                        .stream().collect(java.util.stream.Collectors.toMap(s -> s.sourceRaiseRequestId, s -> s.id));
        return PageResponse.of(result, r -> RaiseDtos.view(r, generated.get(r.id)));
    }

    public RaiseDtos.View create(RaiseDtos.Input input) {
        people.requireUsable(input.personId());
        RaiseRequest request = new RaiseRequest();
        request.initialize(clock);
        RaiseDtos.apply(request, input);
        request.status = "draft";
        validateValues(request);
        requests.saveAndFlush(request);
        record(request, "raise_created", "personId,baseSalaryId,requestedOn,requestedSalary,requestedPercentage,motivation,status");
        return view(request);
    }

    public RaiseDtos.View update(Long id, RaiseDtos.Input input) {
        RaiseRequest request = lock(id);
        writable(request, input.version());
        if (!Set.of("draft", "submitted").contains(request.status)) {
            throw ApiException.conflict("La richiesta non e modificabile in questo stato.");
        }
        if (!Objects.equals(request.personId, input.personId())
                || !Objects.equals(request.baseSalaryId, input.baseSalaryId())) {
            throw ApiException.conflict("Persona e RAL di riferimento non sono modificabili.");
        }
        String fields = changedFields(request, input);
        if (fields.isEmpty()) { return view(request); }
        RaiseDtos.apply(request, input);
        validateValues(request);
        request.touch(clock);
        requests.saveAndFlush(request);
        record(request, "raise_updated", fields);
        return view(request);
    }

    public RaiseDtos.View submit(Long id, Long version) {
        return transition(id, version, "draft", "submitted");
    }

    public RaiseDtos.View reopen(Long id, Long version) {
        return transition(id, version, "postponed", "draft");
    }

    public RaiseDtos.View decide(Long id, RaiseDtos.Decision command, String status) {
        RaiseRequest request = lock(id);
        writable(request, command.version());
        if (!request.status.equals("submitted")) {
            throw ApiException.conflict("Solo una richiesta inviata puo ricevere un esito.");
        }
        outcomeDate(request, command.outcomeOn());
        request.status = status;
        request.outcomeOn = command.outcomeOn();
        request.outcomeNotes = command.outcomeNotes();
        request.touch(clock);
        requests.saveAndFlush(request);
        record(request, "raise_updated", "status,outcomeOn,outcomeNotes");
        return view(request);
    }

    public RaiseDtos.View approve(Long id, RaiseDtos.Outcome command) {
        Dates.check(command.effectiveOn());
        RaiseRequest request = lock(id);
        Queries.editable(request);
        if (command.createSalary() != (command.effectiveOn() != null)) {
            throw ApiException.invalid("Decorrenza richiesta solo se si crea una RAL.");
        }
        var existing = salaries.findBySourceRaiseRequestId(id);
        if (request.status.equals("approved")) {
            boolean matching = Objects.equals(request.outcomeOn, command.outcomeOn())
                    && Objects.equals(request.outcomeNotes, command.outcomeNotes())
                    && command.createSalary() == existing.isPresent()
                    && (!command.createSalary()
                        || existing.get().effectiveOn.equals(command.effectiveOn()));
            if (!matching) { throw ApiException.conflict("Approvazione gia registrata con dati diversi."); }
            return view(request);
        }
        writable(request, command.version());
        if (!request.status.equals("submitted")) {
            throw ApiException.conflict("Solo una richiesta inviata puo essere approvata.");
        }
        outcomeDate(request, command.outcomeOn());
        BigDecimal target = validateValues(request);
        request.status = "approved";
        request.outcomeOn = command.outcomeOn();
        request.outcomeNotes = command.outcomeNotes();
        request.touch(clock);
        requests.saveAndFlush(request);
        if (command.createSalary()) {
            salaryService.generateApproved(request.personId, target, request.currency,
                    command.effectiveOn(), "Approvazione richiesta " + request.id, request.id);
        }
        record(request, "raise_updated", "status,outcomeOn,outcomeNotes");
        return view(request);
    }

    public RaiseDtos.View archive(Long id, Long version) {
        RaiseRequest request = lock(id);
        boolean changed = request.archivedAt == null;
        request.archive(version, clock);
        requests.saveAndFlush(request);
        if (changed) { record(request, "raise_archived", "archivedAt"); }
        return view(request);
    }

    private RaiseDtos.View transition(Long id, Long version, String from, String to) {
        RaiseRequest request = lock(id);
        writable(request, version);
        if (!request.status.equals(from)) { throw ApiException.conflict("Transizione di stato non valida."); }
        request.status = to;
        request.outcomeOn = null;
        request.outcomeNotes = null;
        request.touch(clock);
        requests.saveAndFlush(request);
        record(request, "raise_updated", "status,outcomeOn,outcomeNotes");
        return view(request);
    }

    private RaiseRequest lock(Long id) {
        return requests.lockById(id).orElseThrow(ApiException::missing);
    }

    private void writable(RaiseRequest request, Long version) {
        Queries.editable(request);
        Queries.version(request, version);
        people.requireUsable(request.personId);
    }

    private static void outcomeDate(RaiseRequest request, java.time.LocalDate date) {
        Dates.check(date);
        if (date.isBefore(request.requestedOn)) { throw ApiException.invalid("Esito precedente alla richiesta."); }
    }

    private BigDecimal validateValues(RaiseRequest request) {
        Dates.check(request.requestedOn);
        Salary base = salaryService.get(request.baseSalaryId);
        if (!Objects.equals(base.personId, request.personId) || base.effectiveOn.isAfter(request.requestedOn)) {
            throw ApiException.invalid("La RAL base non e valida per persona e data richiesta.");
        }
        request.currency = base.currency;
        return target(base.amount, request.requestedSalary, request.requestedPercentage);
    }

    public static BigDecimal target(BigDecimal base, BigDecimal amount, BigDecimal percentage) {
        if (amount == null && percentage == null) {
            throw ApiException.invalid("Specificare RAL desiderata oppure percentuale.");
        }
        BigDecimal computed = percentage == null ? null
                : base.multiply(BigDecimal.ONE.add(percentage.movePointLeft(2))).setScale(2, RoundingMode.HALF_UP);
        if (amount != null && computed != null && amount.compareTo(computed) != 0) {
            throw ApiException.invalid("RAL desiderata e percentuale non sono coerenti.");
        }
        BigDecimal target = amount == null ? computed : amount;
        if (target.compareTo(base) <= 0 || target.compareTo(new BigDecimal("9999999999.99")) > 0) {
            throw ApiException.invalid("La RAL richiesta deve superare la base e rispettare il limite monetario.");
        }
        return target;
    }

    private RaiseDtos.View view(RaiseRequest request) {
        return RaiseDtos.view(request, salaries.findBySourceRaiseRequestId(request.id).map(s -> s.id).orElse(null));
    }

    private void record(RaiseRequest request, String action, String fields) {
        audit.record(request.personId, null, request.id, action, fields);
    }

    private static String changedFields(RaiseRequest r, RaiseDtos.Input i) {
        java.util.List<String> fields = new java.util.ArrayList<>();
        if (!Objects.equals(r.requestedOn, i.requestedOn())) { fields.add("requestedOn"); }
        if (!sameDecimal(r.requestedSalary, i.requestedSalary())) { fields.add("requestedSalary"); }
        if (!sameDecimal(r.requestedPercentage, i.requestedPercentage())) { fields.add("requestedPercentage"); }
        if (!Objects.equals(r.motivation, i.motivation())) { fields.add("motivation"); }
        return String.join(",", fields);
    }

    private static boolean sameDecimal(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }
}
