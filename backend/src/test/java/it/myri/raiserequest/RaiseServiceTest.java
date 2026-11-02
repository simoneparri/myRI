package it.myri.raiserequest;

import static org.junit.jupiter.api.Assertions.*;

import it.myri.common.ApiException;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class RaiseServiceTest {
    private static BigDecimal amount(String value) { return new BigDecimal(value); }

    @Test
    void targetAcceptsAmountPercentageOrCoherentBoth() {
        assertEquals(amount("55000.00"), RaiseService.target(amount("50000"), amount("55000.00"), null));
        assertEquals(amount("55000.00"), RaiseService.target(amount("50000"), null, amount("10")));
        assertEquals(amount("55000.00"), RaiseService.target(amount("50000"), amount("55000.00"), amount("10")));
    }

    @Test
    void targetRoundsHalfUpWithoutBinaryFloatingPoint() {
        assertEquals(amount("101.51"), RaiseService.target(amount("100.01"), null, amount("1.5")));
    }

    @Test
    void targetRejectsMissingInconsistentNonIncreasingAndOverflowingValues() {
        assertThrows(ApiException.class, () -> RaiseService.target(amount("50000"), null, null));
        assertThrows(ApiException.class, () -> RaiseService.target(amount("50000"), amount("56000"), amount("10")));
        assertThrows(ApiException.class, () -> RaiseService.target(amount("50000"), amount("50000"), null));
        assertThrows(ApiException.class, () -> RaiseService.target(amount("9999999999.99"), null, amount("1")));
    }
}
