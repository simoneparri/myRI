package it.myri;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;

@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTest {
    protected static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8")
            .withDatabaseName("myri_api_test")
            .withUsername("api_test")
            .withPassword("ephemeral-test-password")
            .withUrlParam("serverTimezone", "UTC")
            .withCommand("--character-set-server=utf8mb4",
                    "--collation-server=utf8mb4_0900_ai_ci", "--default-time-zone=+00:00",
                    "--log-bin-trust-function-creators=1");

    static {
        MYSQL.start();
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", MYSQL::getJdbcUrl);
        properties.add("spring.datasource.username", MYSQL::getUsername);
        properties.add("spring.datasource.password", MYSQL::getPassword);
        properties.add("spring.flyway.url", MYSQL::getJdbcUrl);
        properties.add("spring.flyway.user", MYSQL::getUsername);
        properties.add("spring.flyway.password", MYSQL::getPassword);
        properties.add("myri.bootstrap.username", () -> "owner");
        properties.add("myri.bootstrap.password", () -> "fictitious-test-password");
    }
}
