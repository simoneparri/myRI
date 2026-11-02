package it.myri.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import java.math.BigDecimal;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI api() {
        SpringDocUtils.getConfig()
                .replaceWithSchema(Long.class, new StringSchema().pattern("^[0-9]+$"))
                .replaceWithSchema(BigDecimal.class, new StringSchema().pattern("^[0-9]+(\\.[0-9]+)?$"));
        var responses = new ApiResponses().addApiResponse("204", new ApiResponse().description("Operazione completata"))
                .addApiResponse("401", new ApiResponse().description("Credenziali non valide"))
                .addApiResponse("403", new ApiResponse().description("CSRF non valido"));
        return new OpenAPI().info(new Info().title("myRI REST API").version("v1")
                .description("Login form e sessione HttpOnly. Recuperare /api/v1/auth/csrf prima del login "
                        + "e dopo login/logout; inviare il token nell'header restituito per ogni scrittura."))
                .components(new Components().addSecuritySchemes("session",
                        new SecurityScheme().type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.COOKIE)
                                .name("JSESSIONID"))
                        .addSecuritySchemes("csrf", new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER).name("X-CSRF-TOKEN")))
                .path("/api/v1/auth/login", new PathItem().post(new Operation().operationId("login")
                        .summary("Login con rotazione sessione; richiede CSRF")
                        .security(java.util.List.of(new SecurityRequirement().addList("csrf")))
                        .requestBody(new RequestBody().required(true).content(new Content()
                                .addMediaType("application/x-www-form-urlencoded", new MediaType().schema(
                                        new ObjectSchema().addProperty("username", new StringSchema())
                                                .addProperty("password", new StringSchema().format("password"))
                                                .required(java.util.List.of("username", "password"))))))
                        .responses(responses)))
                .path("/api/v1/auth/logout", new PathItem().post(new Operation().operationId("logout")
                        .summary("Logout e invalidazione sessione; richiede CSRF")
                        .security(java.util.List.of(new SecurityRequirement().addList("session").addList("csrf")))
                        .responses(responses)))
                .addSecurityItem(new SecurityRequirement().addList("session"));
    }
}
