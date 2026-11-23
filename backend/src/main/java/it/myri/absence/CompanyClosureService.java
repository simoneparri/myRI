package it.myri.absence;

import it.myri.auth.AppUserRepository;
import it.myri.common.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompanyClosureService {
    private final CompanyClosureRepository closures;
    private final AppUserRepository users;
    private final Clock clock;

    public CompanyClosureService(CompanyClosureRepository closures, AppUserRepository users, Clock clock) {
        this.closures = closures;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<LocalDate> month(YearMonth month) {
        return closures.findByClosedOnGreaterThanEqualAndClosedOnLessThanAndArchivedAtIsNullOrderByClosedOn(
                month.atDay(1), month.plusMonths(1).atDay(1)).stream().map(c -> c.closedOn).toList();
    }

    @Transactional
    public void add(LocalDate date) {
        validate(date);
        users.lockSingleton().orElseThrow(() -> ApiException.conflict("Utente non disponibile."));
        CompanyClosure closure = closures.findByClosedOn(date).orElse(null);
        if (closure == null) {
            closure = new CompanyClosure();
            closure.closedOn = date;
            closure.initialize(clock);
            closures.save(closure);
        } else if (closure.archivedAt != null) {
            closure.archivedAt = null;
            closure.touch(clock);
        }
    }

    @Transactional
    public void cancel(LocalDate date) {
        validate(date);
        users.lockSingleton().orElseThrow(() -> ApiException.conflict("Utente non disponibile."));
        CompanyClosure closure = closures.findByClosedOn(date).orElseThrow(ApiException::missing);
        if (closure.archivedAt != null) throw ApiException.missing();
        closure.archivedAt = clock.instant();
        closure.touch(clock);
    }

    private static void validate(LocalDate date) {
        if (date == null || date.getYear() < 1000 || date.getYear() > 9998) {
            throw ApiException.invalid("Data di chiusura non valida.");
        }
    }
}
