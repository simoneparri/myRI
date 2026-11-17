package it.myri.export;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import it.myri.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.io.IOException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/transfers")
public class TransferController {
    private final TransferService service;
    private final ObjectMapper json;
    public TransferController(TransferService service, ObjectMapper json) {
        this.service = service;
        this.json = json;
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> export(@Valid @RequestBody TransferDtos.Selection selection)
            throws JsonProcessingException {
        byte[] bytes = json.writeValueAsBytes(service.export(selection.personIds()));
        if (bytes.length > TransferDtos.MAX_BYTES) throw ApiException.invalid("File oltre il limite di 10 MiB.");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"myri-transfer.json\"")
                .contentType(MediaType.APPLICATION_JSON).body(bytes);
    }

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    @io.swagger.v3.oas.annotations.Operation(summary = "Importa un file di trasferimento myRI",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true,
                    content = @io.swagger.v3.oas.annotations.media.Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                            schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = TransferDtos.Bundle.class))))
    public ResponseEntity<TransferDtos.Report> importFile(HttpServletRequest request) throws IOException {
        byte[] bytes = request.getInputStream().readNBytes(TransferDtos.MAX_BYTES + 1);
        if (bytes.length > TransferDtos.MAX_BYTES) throw ApiException.invalid("File oltre il limite di 10 MiB.");
        TransferDtos.Bundle bundle;
        try {
            bundle = json.readerFor(TransferDtos.Bundle.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                    .without(DeserializationFeature.ACCEPT_FLOAT_AS_INT).readValue(bytes);
        } catch (JsonProcessingException exception) {
            throw ApiException.invalid("File JSON di trasferimento non valido o non compatibile.");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.importFile(bundle));
    }
}
