package it.myri.salary;

import it.myri.audit.AuditService;
import it.myri.auth.AppUserRepository;
import it.myri.common.*;
import it.myri.person.PersonService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Currency;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SalaryService {
    private final SalaryRepository salaries;
    private final PersonService people;
    private final AuditService audit;
    private final AppUserRepository users;
    private final Clock clock;

    public SalaryService(SalaryRepository salaries, PersonService people, AuditService audit,
            AppUserRepository users, Clock clock) {
        this.salaries = salaries;
        this.people = people;
        this.audit = audit;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Salary get(Long id) { return salaries.findById(id).orElseThrow(ApiException::missing); }

    @Transactional(readOnly = true)
    public PageResponse<SalaryDtos.View> list(Long personId, String q, String currency,
            LocalDate from, LocalDate to, int page, int size, String sort) {
        Dates.check(from);
        Dates.check(to);
        people.get(personId);
        if (from != null && to != null && from.isAfter(to)) {
            throw ApiException.invalid("Intervallo date non valido.");
        }
        if (currency != null) { currency(currency); }
        org.springframework.data.jpa.domain.Specification<Salary> dates = (r, query, cb) -> cb.and(
                from == null ? cb.conjunction() : cb.greaterThanOrEqualTo(r.get("effectiveOn"), from),
                to == null ? cb.conjunction() : cb.lessThan(r.get("effectiveOn"), to));
        return PageResponse.of(salaries.findAll(Queries.<Salary>equal("personId", personId)
                .and(Queries.equal("currency", currency)).and(Queries.text(q, "reason")).and(dates),
                Queries.page(page, size, sort, Set.of("id", "effectiveOn", "amount", "createdAt"))), SalaryDtos::view);
    }

    public SalaryDtos.View create(Long personId, SalaryDtos.Input input) {
        Dates.check(input.effectiveOn());
        users.lockSingleton().orElseThrow(ApiException::missing);
        people.requireUsable(personId);
        currency(input.currency());
        var existing = salaries.findByRequestKey(input.requestKey());
        if (existing.isPresent()) {
            Salary salary = existing.get();
            if (!Objects.equals(salary.personId, personId) || salary.amount.compareTo(input.amount()) != 0
                    || !salary.currency.equals(input.currency()) || !salary.effectiveOn.equals(input.effectiveOn())
                    || !Objects.equals(salary.contractType, input.contractType().strip())
                    || !sameDecimal(salary.weeklyHours, input.weeklyHours())
                    || !Objects.equals(salary.classificationLevel, input.classificationLevel().strip())
                    || !salary.reason.equals(input.reason())) {
                throw ApiException.conflict("Chiave idempotenza gia usata con dati diversi.");
            }
            return SalaryDtos.view(salary);
        }
        Salary salary = build(personId, input.amount(), input.currency(), input.effectiveOn(),
                input.contractType().strip(), input.weeklyHours(), input.classificationLevel().strip(), input.reason());
        salary.requestKey = input.requestKey();
        return SalaryDtos.view(saveAndAudit(salary));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Salary generateApproved(Long personId, BigDecimal amount, String currency,
            LocalDate effectiveOn, String contractType, BigDecimal weeklyHours,
            String classificationLevel, String reason, Long requestId) {
        Salary salary = build(personId, amount, currency, effectiveOn, contractType,
                weeklyHours, classificationLevel, reason);
        salary.sourceRaiseRequestId = requestId;
        return saveAndAudit(salary);
    }

    public static void currency(String code) {
        try {
            if (!code.matches("[A-Z]{3}")) { throw new IllegalArgumentException(); }
            Currency.getInstance(code);
        } catch (IllegalArgumentException exception) {
            throw ApiException.invalid("Codice valuta non valido.");
        }
    }

    private Salary build(Long personId, BigDecimal amount, String currency, LocalDate effectiveOn,
            String contractType, BigDecimal weeklyHours, String classificationLevel, String reason) {
        Salary salary = new Salary();
        salary.personId = personId;
        salary.amount = amount;
        salary.currency = currency;
        salary.effectiveOn = effectiveOn;
        salary.contractType = contractType;
        salary.weeklyHours = weeklyHours;
        salary.classificationLevel = classificationLevel;
        salary.reason = reason;
        salary.createdAt = clock.instant();
        return salary;
    }

    private Salary saveAndAudit(Salary salary) {
        salaries.saveAndFlush(salary);
        audit.record(salary.personId, salary.id, null, "salary_created",
                "amount,currency,effectiveOn,contractType,weeklyHours,classificationLevel,reason,sourceRaiseRequestId");
        return salary;
    }

    private static boolean sameDecimal(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }
}
