package it.myri.common;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger LOG = LoggerFactory.getLogger(ApiErrors.class);

    @ExceptionHandler(ApiException.class)
    ProblemDetail domain(ApiException exception) {
        return ProblemDetail.forStatusAndDetail(exception.status, exception.getMessage());
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class, ConstraintViolationException.class,
        HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
        HandlerMethodValidationException.class
    })
    ProblemDetail validation(Exception exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Dati non validi: verificare formato, campi obbligatori e limiti.");
    }

    @ExceptionHandler({DataIntegrityViolationException.class, OptimisticLockingFailureException.class})
    ProblemDetail conflict(Exception exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "Operazione in conflitto con lo stato corrente dei dati.");
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception exception) {
        // Do not log exception messages or stack traces, which may contain bound personal data.
        LOG.error("Richiesta fallita: categoria {}", exception.getClass().getSimpleName());
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Errore interno. Riprovare o contattare l'amministratore.");
    }
}
