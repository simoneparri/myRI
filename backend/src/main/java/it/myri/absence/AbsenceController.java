package it.myri.absence;

import it.myri.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/absences")
public class AbsenceController {
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private final AbsenceService service;

    public AbsenceController(AbsenceService service) { this.service = service; }

    @PostMapping(value = "/import", consumes = "text/csv")
    public AbsenceDtos.ImportReport importCsv(HttpServletRequest request) throws IOException {
        byte[] bytes = request.getInputStream().readNBytes(MAX_BYTES + 1);
        if (bytes.length == 0 || bytes.length > MAX_BYTES) {
            throw ApiException.invalid("Il CSV deve essere non vuoto e non superare 2 MiB.");
        }
        try {
            String csv = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString();
            return service.importCsv(csv);
        } catch (CharacterCodingException exception) {
            throw ApiException.invalid("Il CSV deve essere codificato in UTF-8.");
        }
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public List<AbsenceDtos.View> month(@RequestParam String month,
            @RequestParam(required = false) List<Long> personIds) {
        try {
            YearMonth parsed = YearMonth.parse(month);
            if (parsed.getYear() < 1000 || parsed.getYear() > 9998) throw new DateTimeParseException("", month, 0);
            return service.month(parsed, personIds == null ? List.of() : personIds);
        } catch (DateTimeParseException exception) {
            throw ApiException.invalid("Mese non valido: usare il formato AAAA-MM.");
        }
    }
}
