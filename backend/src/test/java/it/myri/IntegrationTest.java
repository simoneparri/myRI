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
        try (var connection = java.sql.DriverManager.getConnection(
                MYSQL.getJdbcUrl(), "root", MYSQL.getPassword());
                var sql = connection.createStatement()) {
            sql.execute("CREATE USER 'runtime_test'@'%' IDENTIFIED BY 'ephemeral-runtime-password'");
            sql.execute("CREATE USER 'migration_test'@'%' IDENTIFIED BY 'ephemeral-migration-password'");
            sql.execute("GRANT CREATE, ALTER, INDEX, REFERENCES, TRIGGER, SELECT, INSERT, UPDATE "
                    + "ON myri_api_test.* TO 'migration_test'@'%' WITH GRANT OPTION");
        } catch (java.sql.SQLException exception) {
            throw new IllegalStateException("Impossibile inizializzare utenti DB effimeri.", exception);
        }
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", MYSQL::getJdbcUrl);
        properties.add("spring.datasource.username", () -> "runtime_test");
        properties.add("spring.datasource.password", () -> "ephemeral-runtime-password");
        properties.add("spring.flyway.url", MYSQL::getJdbcUrl);
        properties.add("spring.flyway.user", () -> "migration_test");
        properties.add("spring.flyway.password", () -> "ephemeral-migration-password");
        properties.add("myri.bootstrap.username", () -> "owner");
        properties.add("myri.bootstrap.password", () -> "fictitious-test-password");
    }
}
