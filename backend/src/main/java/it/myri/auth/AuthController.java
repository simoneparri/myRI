package it.myri.auth;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {
    public record Identity(Long id, String username) {}

    @GetMapping("/api/v1/auth/csrf")
    public Map<String, String> csrf(CsrfToken csrf) {
        return Map.of("headerName", csrf.getHeaderName(), "parameterName", csrf.getParameterName(),
                "token", csrf.getToken());
    }

    @GetMapping("/api/v1/auth/me")
    public Identity me(@AuthenticationPrincipal AccountPrincipal principal) {
        return new Identity(principal.id(), principal.getUsername());
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
