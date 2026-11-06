package it.myri.salary;

import it.myri.common.PageResponse;
import it.myri.common.Queries;
import it.myri.person.Person;
import it.myri.person.PersonMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SalaryComparisonService {
    private static final Map<String, List<String>> SORTS = Map.of(
            "lastName", List.of("p.lastName", "p.firstName"), "role", List.of("p.role"),
            "seniorityLevel", List.of("p.seniorityLevel"), "amount", List.of("s.amount"),
            "bornOn", List.of("p.bornOn"), "hiredOn", List.of("p.hiredOn"), "id", List.of("p.id"));
    private final SalaryComparisonRepository comparisons;
    private final Clock clock;
    private final ZoneId zone;

    public SalaryComparisonService(SalaryComparisonRepository comparisons, Clock clock, ZoneId zone) {
        this.comparisons = comparisons;
        this.clock = clock;
        this.zone = zone;
    }

    public PageResponse<SalaryComparisonDtos.View> list(boolean includeArchived, int page, int size, String sort) {
        PageRequest request = Queries.page(page, size, sort, Set.copyOf(SORTS.keySet()));
        // API sort keys are whitelisted and mapped to JPQL aliases of the join query.
        Sort mapped = Sort.unsorted();
        for (Sort.Order order : request.getSort()) {
            for (String path : SORTS.get(order.getProperty())) {
                mapped = mapped.and(Sort.by(order.getDirection(), path));
            }
        }
        LocalDate today = LocalDate.now(clock.withZone(zone));
        return PageResponse.of(comparisons.current(today, includeArchived,
                PageRequest.of(page, size, mapped)), row -> view((Person) row[0], (Salary) row[1], today));
    }

    private static SalaryComparisonDtos.View view(Person p, Salary s, LocalDate today) {
        var person = PersonMapper.view(p, today);
        return new SalaryComparisonDtos.View(p.id, p.firstName, p.lastName, p.role, p.seniorityLevel,
                p.status, p.archivedAt, p.bornOn, person.age(), p.hiredOn, person.seniority(),
                s.id, s.amount, s.currency, s.effectiveOn, s.classificationLevel,
                s.mealVouchers, s.bonusLetterAmount, s.companyCar);
    }
}
