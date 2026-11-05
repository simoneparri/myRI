package it.myri.salary;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import it.myri.audit.AuditService;
import it.myri.auth.AppUser;
import it.myri.auth.AppUserRepository;
import it.myri.common.ApiException;
import it.myri.person.PersonService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SalaryServiceTest {
    private final SalaryRepository repository = mock(SalaryRepository.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final PersonService people = mock(PersonService.class);
    private final AuditService audit = mock(AuditService.class);
    private final SalaryService service = new SalaryService(repository, people, audit, users, Clock.systemUTC());

    @Test
    void manualCreationPersistsNullableBenefitsAndAuditsOnlyFieldNames() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        when(repository.findByRequestKey("fictitious-key")).thenReturn(Optional.empty());
        var result = service.create(1L, input(false, "0.00", null));
        assertEquals(false, result.mealVouchers());
        assertEquals(new BigDecimal("0.00"), result.bonusLetterAmount());
        assertNull(result.companyCar());
        var salary = org.mockito.ArgumentCaptor.forClass(Salary.class);
        verify(repository).saveAndFlush(salary.capture());
        assertEquals(false, salary.getValue().mealVouchers);
        verify(audit).record(eq(1L), isNull(), isNull(), eq("salary_created"),
                contains("mealVouchers,bonusLetterAmount,companyCar"));
    }

    @Test
    void retriesCompareBenefitsIncludingFalseNullAndDecimalScale() {
        when(users.lockSingleton()).thenReturn(Optional.of(new AppUser()));
        Salary salary = new Salary();
        salary.id = 2L;
        salary.personId = 1L;
        salary.amount = new BigDecimal("50000.00");
        salary.currency = "EUR";
        salary.effectiveOn = LocalDate.of(2026, 1, 1);
        salary.contractType = "Fictitious contract";
        salary.weeklyHours = new BigDecimal("40");
        salary.classificationLevel = "Fictitious level";
        salary.reason = "Fictitious reason";
        salary.mealVouchers = false;
        salary.bonusLetterAmount = new BigDecimal("1000.00");
        when(repository.findByRequestKey("fictitious-key")).thenReturn(Optional.of(salary));
        assertEquals(2L, service.create(1L, input(false, "1000.0", null)).id());
        assertThrows(ApiException.class, () -> service.create(1L, input(true, "1000", null)));
        assertThrows(ApiException.class, () -> service.create(1L, input(null, "1000", null)));
        assertThrows(ApiException.class, () -> service.create(1L, input(false, "1001", null)));
        assertThrows(ApiException.class, () -> service.create(1L, input(false, "1000", false)));
        verify(repository, never()).saveAndFlush(any());
        verifyNoInteractions(audit);
    }

    @Test
    void approvedCreationCopiesBenefitsWithoutChangingTheSource() {
        Salary base = new Salary();
        base.mealVouchers = true;
        base.bonusLetterAmount = new BigDecimal("1500.00");
        base.companyCar = false;
        Salary generated = service.generateApproved(1L, new BigDecimal("55000"), "EUR",
                LocalDate.of(2026, 2, 1), "Fictitious contract", new BigDecimal("40"),
                "Fictitious level", "Fictitious approval", 3L, SalaryDtos.benefits(base));
        assertTrue(SalaryService.sameBenefits(generated, SalaryDtos.benefits(base)));
        assertEquals(3L, generated.sourceRaiseRequestId);
        assertEquals(new BigDecimal("1500.00"), base.bonusLetterAmount);
    }

    private SalaryDtos.Input input(Boolean mealVouchers, String bonus, Boolean car) {
        return new SalaryDtos.Input(new BigDecimal("50000"), "EUR", LocalDate.of(2026, 1, 1),
                "Fictitious contract", new BigDecimal("40"), "Fictitious level", "Fictitious reason",
                "fictitious-key", mealVouchers, bonus == null ? null : new BigDecimal(bonus), car);
    }
}
