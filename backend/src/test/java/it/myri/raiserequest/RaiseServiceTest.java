package it.myri.raiserequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import it.myri.audit.AuditService;
import it.myri.common.ApiException;
import it.myri.person.PersonService;
import it.myri.salary.Salary;
import it.myri.salary.SalaryRepository;
import it.myri.salary.SalaryService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;

class RaiseServiceTest {
    private static BigDecimal amount(String value) { return new BigDecimal(value); }

    @Test
    void createSavesBothValuesForEitherInput() {
        var requests = mock(RaiseRequestRepository.class);
        var salaries = mock(SalaryRepository.class);
        var salaryService = mock(SalaryService.class);
        var service = new RaiseService(requests, salaries, salaryService, mock(PersonService.class),
                mock(AuditService.class), Clock.systemUTC());
        var base = new Salary();
        base.personId = 1L;
        base.amount = amount("45000.00");
        base.currency = "EUR";
        base.effectiveOn = LocalDate.of(2025, 1, 1);
        when(salaryService.get(2L)).thenReturn(base);

        service.create(new RaiseDtos.Input(1L, 2L, LocalDate.of(2026, 1, 1),
                amount("45250.00"), null, "Fittizia", null, null));
        service.create(new RaiseDtos.Input(1L, 2L, LocalDate.of(2026, 1, 1),
                null, amount("5.25"), "Fittizia", null, null));

        var saved = ArgumentCaptor.forClass(RaiseRequest.class);
        verify(requests, times(2)).saveAndFlush(saved.capture());
        assertEquals(amount("45250.00"), saved.getAllValues().get(0).requestedSalary);
        assertEquals(amount("0.6"), saved.getAllValues().get(0).requestedPercentage);
        assertEquals(amount("47362.50"), saved.getAllValues().get(1).requestedSalary);
        assertEquals(amount("5.25"), saved.getAllValues().get(1).requestedPercentage);
    }

    @Test
    void targetAcceptsAmountPercentageOrCoherentBoth() {
        assertEquals(amount("55000.00"), RaiseService.target(amount("50000"), amount("55000.00"), null));
        assertEquals(amount("55000.00"), RaiseService.target(amount("50000"), null, amount("10")));
        assertEquals(amount("55000.00"), RaiseService.target(amount("50000"), amount("55000.00"), amount("10")));
    }

    @Test
    void targetRoundsHalfUpWithoutBinaryFloatingPoint() {
        assertEquals(amount("101.51"), RaiseService.target(amount("100.01"), null, amount("1.5")));
        assertEquals(amount("45250.00"), RaiseService.target(amount("45000.00"), amount("45250.00"), amount("0.6")));
        assertEquals(amount("45000.01"), RaiseService.target(amount("45000.00"), amount("45000.01"), amount("0.1")));
        assertEquals(amount("110.00"), RaiseService.target(amount("100"), amount("110.00"), amount("9.9999")));
    }

    @Test
    void targetRejectsMissingInconsistentNonIncreasingAndOverflowingValues() {
        assertThrows(ApiException.class, () -> RaiseService.target(amount("50000"), null, null));
        assertThrows(ApiException.class, () -> RaiseService.target(amount("50000"), amount("56000"), amount("10")));
        assertThrows(ApiException.class, () -> RaiseService.target(amount("45000"), amount("45250"), amount("0.7")));
        assertThrows(ApiException.class, () -> RaiseService.target(amount("50000"), amount("50000"), null));
        assertThrows(ApiException.class, () -> RaiseService.target(amount("9999999999.99"), null, amount("1")));
    }
}
