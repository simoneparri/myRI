package it.myri.config;

import it.myri.auth.AppUserRepository;
import it.myri.auth.CredentialVersionFilter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwords() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    @ConditionalOnWebApplication
    SecurityFilterChain security(HttpSecurity http, AppUserRepository users) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/login", "/health").permitAll()
                        .anyRequest().hasRole("OWNER"))
                .requestCache(cache -> cache.disable())
                .formLogin(login -> login.loginProcessingUrl("/api/v1/auth/login")
                        .successHandler((request, response, auth) -> response.setStatus(204))
                        .failureHandler((request, response, exception) ->
                                problem(response, 401, "Credenziali non valide.")))
                .logout(logout -> logout.logoutUrl("/api/v1/auth/logout")
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, auth) -> response.setStatus(204)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                problem(response, 401, "Autenticazione richiesta."))
                        .accessDeniedHandler((request, response, exception) ->
                                problem(response, 403, "Operazione non autorizzata o token CSRF non valido.")))
                .addFilterBefore(new CredentialVersionFilter(users), AuthorizationFilter.class)
                .build();
    }

    private static void problem(jakarta.servlet.http.HttpServletResponse response, int status,
            String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"type\":\"about:blank\",\"status\":" + status
                + ",\"detail\":\"" + message + "\"}");
    }
}
