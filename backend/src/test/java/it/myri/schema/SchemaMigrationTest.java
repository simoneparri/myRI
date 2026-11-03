package it.myri.schema;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Set;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class SchemaMigrationTest {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8")
            .withDatabaseName("myri_schema_test")
            .withUsername("schema_test")
            .withPassword("ephemeral-test-only")
            .withUrlParam("serverTimezone", "UTC")
            .withCommand(
                    "--character-set-server=utf8mb4",
                    "--collation-server=utf8mb4_0900_ai_ci",
                    "--default-time-zone=+00:00",
                    "--log-bin-trust-function-creators=1");

    private Connection connection;

    @BeforeAll
    static void migrateProductionSchema() throws SQLException {
        Flyway initial = Flyway.configure()
                .dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
                .locations("classpath:db/migration")
                .target("1")
                .cleanDisabled(true)
                .load();
        assertEquals(1, initial.migrate().migrationsExecuted);
        try (Connection connection = DriverManager.getConnection(
                MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
                Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO person (id, first_name, last_name, hired_on)
                    VALUES (700000, 'Fictitious', 'Upgrade fixture', '2026-01-01')
                    """);
            statement.executeUpdate("""
                    INSERT INTO salary (id, person_id, amount, currency, effective_on, reason)
                    VALUES (700000, 700000, 40000.12, 'EUR', '2026-01-01', 'Fictitious upgrade fixture')
                    """);
        }
        Flyway flyway = flyway();
        assertEquals(3, flyway.migrate().migrationsExecuted);
        flyway.validate();
        assertEquals(0, flyway.migrate().migrationsExecuted);
    }

    @BeforeEach
    void connect() throws SQLException {
        connection = DriverManager.getConnection(
                MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
        connection.setAutoCommit(false);
    }

    @AfterEach
    void rollbackAndClose() throws SQLException {
        if (connection != null) {
            try {
                connection.rollback();
            } finally {
                connection.close();
            }
        }
    }

    @Test
    void historyCreatedBeforeUpgradeIsPreservedAndProtected() throws SQLException {
        assertEquals(1, scalar("""
                SELECT COUNT(*) FROM salary
                WHERE id = 700000 AND person_id = 700000 AND amount = 40000.12
                """));
        assertEquals(1644, rejected("UPDATE salary SET amount = 1 WHERE id = 700000").getErrorCode());
        assertEquals(1644, rejected("DELETE FROM salary WHERE id = 700000").getErrorCode());
    }

    @Test
    void allTablesUseInnoDbUtf8AndLowercaseNames() throws SQLException {
        try (Statement statement = connection.createStatement();
                ResultSet tables = statement.executeQuery("""
                        SELECT table_name, engine, table_collation
                        FROM information_schema.tables
                        WHERE table_schema = DATABASE() AND table_name <> 'flyway_schema_history'
                        """)) {
            int count = 0;
            while (tables.next()) {
                assertTrue(tables.getString(1).matches("[a-z_]+"));
                assertEquals("InnoDB", tables.getString(2));
                assertEquals("utf8mb4_0900_ai_ci", tables.getString(3));
                count++;
            }
            assertEquals(9, count);
        }
        assertEquals(0, scalar("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND data_type = 'enum'
                """));
        assertEquals(9, scalar("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND column_name = 'id'
                  AND data_type = 'bigint' AND extra = 'auto_increment'
                """));
    }

    @Test
    void foreignKeysRestrictDeletesAndHaveLeadingIndexes() throws SQLException {
        assertEquals(0, scalar("""
                SELECT COUNT(*) FROM information_schema.referential_constraints
                WHERE constraint_schema = DATABASE()
                  AND (delete_rule <> 'RESTRICT' OR update_rule <> 'RESTRICT')
                """));
        assertTrue(scalar("""
                SELECT COUNT(*) FROM information_schema.referential_constraints
                WHERE constraint_schema = DATABASE()
                """) > 15);
        assertEquals(0, scalar("""
                SELECT COUNT(*) FROM information_schema.key_column_usage k
                WHERE k.table_schema = DATABASE() AND k.referenced_table_name IS NOT NULL
                  AND k.ordinal_position = 1
                  AND NOT EXISTS (
                    SELECT 1 FROM information_schema.statistics s
                    WHERE s.table_schema = k.table_schema AND s.table_name = k.table_name
                      AND s.column_name = k.column_name AND s.seq_in_index = 1
                  )
                """));
        for (String column : List.of("due_at", "held_at")) {
            assertTrue(scalar("""
                    SELECT COUNT(*) FROM information_schema.statistics
                    WHERE table_schema = DATABASE() AND column_name = ?
                      AND seq_in_index = 1
                    """, column) >= 1);
        }
    }

    @Test
    void monetaryAmountsAndLongNotesUseRequiredColumnTypes() throws SQLException {
        assertEquals(2, scalar("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND ((table_name = 'salary' AND column_name = 'amount')
                    OR (table_name = 'raise_request' AND column_name = 'requested_salary'))
                  AND data_type = 'decimal' AND numeric_precision = 12 AND numeric_scale = 2
                """));
        assertEquals(0, scalar("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name <> 'flyway_schema_history'
                  AND column_name IN ('notes', 'motivation', 'reason', 'outcome_notes',
                    'topics', 'agreed_goals', 'feedback_given', 'feedback_received', 'next_steps', 'description')
                  AND data_type <> 'text'
                """));
    }

    @Test
    void databaseAndJdbcUseUtcAndSupportFullUnicode() throws SQLException {
        try (Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("SELECT @@session.time_zone")) {
            assertTrue(result.next());
            assertEquals("+00:00", result.getString(1));
        }
        long person = person();
        String note = "Team \uD83D\uDC65";
        execute("UPDATE person SET notes = ? WHERE id = ?", note, person);
        try (PreparedStatement statement = connection.prepareStatement("SELECT notes FROM person WHERE id = ?")) {
            statement.setLong(1, person);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                assertEquals(note, result.getString(1));
            }
        }
    }

    @Test
    void salaryHasExactDecimalPrecisionAndRemainsAppendOnly() throws SQLException {
        long person = person();
        long first = salary(person, "50000.12");
        long second = salary(person, "55000.34");
        assertNotEquals(first, second);
        try (PreparedStatement statement = connection.prepareStatement("SELECT amount FROM salary WHERE id = ?")) {
            statement.setLong(1, first);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                assertEquals(new BigDecimal("50000.12"), result.getBigDecimal(1));
            }
        }
        rejected("UPDATE salary SET amount = 1 WHERE id = ?", first);
        rejected("DELETE FROM salary WHERE id = ?", first);
        assertEquals(2, scalar("SELECT COUNT(*) FROM salary WHERE person_id = ?", person));
        rejected("""
                INSERT INTO salary (person_id, amount, currency, effective_on, reason)
                VALUES (?, -1, 'EUR', '2026-01-01', 'Invalid')
                """, person);
        rejected("""
                INSERT INTO salary (person_id, amount, currency, effective_on, reason)
                VALUES (?, 1, 'eur', '2026-01-01', 'Invalid')
                """, person);
    }

    @Test
    void managerIsInternalOrExternalAndCannotReferenceSelf() throws SQLException {
        long manager = person();
        long report = person();
        execute("UPDATE person SET manager_id = ? WHERE id = ?", manager, report);
        rejected("UPDATE person SET manager_id = ? WHERE id = ?", report, report);
        rejected("UPDATE person SET external_manager = 'External' WHERE id = ?", report);
        rejected("""
                INSERT INTO person (id, first_name, last_name, hired_on, manager_id)
                VALUES (900000, 'Fictitious', 'Manager', '2026-01-01', 900000)
                """);
        rejected("UPDATE person SET status = 'unknown' WHERE id = ?", report);
    }

    @Test
    void raiseReferencesImmutableBaseOfSamePersonAndCurrency() throws SQLException {
        long person = person();
        long base = salary(person, "50000.00");
        long request = raise(person, base);
        assertTrue(request > 0);
        rejected("""
                INSERT INTO raise_request
                  (person_id, base_salary_id, currency, requested_on, requested_salary, motivation)
                VALUES (?, ?, 'EUR', '2026-01-01', 55000, 'Fictitious request')
                """, person(), base);
        rejected("""
                INSERT INTO raise_request
                  (person_id, base_salary_id, currency, requested_on, requested_salary, motivation)
                VALUES (?, ?, 'USD', '2026-01-01', 55000, 'Fictitious request')
                """, person, base);
        rejected("UPDATE raise_request SET requested_salary = NULL WHERE id = ?", request);
        execute("UPDATE raise_request SET requested_percentage = 10.0000 WHERE id = ?", request);
        rejected("UPDATE raise_request SET requested_percentage = -1 WHERE id = ?", request);
        rejected("UPDATE raise_request SET status = 'approved' WHERE id = ?", request);
        rejected("""
                UPDATE raise_request SET status = 'approved', outcome_on = '2025-01-01'
                WHERE id = ?
                """, request);
        execute("""
                UPDATE raise_request SET status = 'approved', outcome_on = '2026-02-01'
                WHERE id = ?
                """, request);
    }

    @Test
    void approvedRequestCanGenerateOnlyOneSalaryForSamePersonAndCurrency() throws SQLException {
        long person = person();
        long request = raise(person, salary(person, "50000"));
        execute("""
                UPDATE raise_request SET status = 'approved', outcome_on = '2026-02-01'
                WHERE id = ?
                """, request);
        assertEquals(1452, rejected("""
                INSERT INTO salary
                  (person_id, amount, currency, effective_on, reason, source_raise_request_id)
                VALUES (?, 55000, 'EUR', '2026-02-01', 'Wrong person', ?)
                """, person(), request).getErrorCode());
        assertEquals(1452, rejected("""
                INSERT INTO salary
                  (person_id, amount, currency, effective_on, reason, source_raise_request_id)
                VALUES (?, 55000, 'USD', '2026-02-01', 'Wrong currency', ?)
                """, person, request).getErrorCode());
        execute("""
                INSERT INTO salary
                  (person_id, amount, currency, effective_on, reason, source_raise_request_id)
                VALUES (?, 55000, 'EUR', '2026-02-01', 'Fictitious approval', ?)
                """, person, request);
        assertEquals(1062, rejected("""
                INSERT INTO salary
                  (person_id, amount, currency, effective_on, reason, source_raise_request_id)
                VALUES (?, 55000, 'EUR', '2026-02-01', 'Duplicate', ?)
                """, person, request).getErrorCode());
    }

    @Test
    void taskAllowsMultipleLinksOnlyWithinSamePerson() throws SQLException {
        long person = person();
        long other = person();
        long talk = insert("INSERT INTO career_talk (person_id, held_at) VALUES (?, '2026-02-01 10:00:00')", person);
        long request = raise(person, salary(person, "50000"));
        execute("""
                INSERT INTO task (title, person_id, career_talk_id, raise_request_id)
                VALUES ('Fictitious follow-up', ?, ?, ?)
                """, person, talk, request);
        rejected("""
                INSERT INTO task (title, person_id, career_talk_id)
                VALUES ('Wrong person', ?, ?)
                """, other, talk);
        rejected("INSERT INTO task (title, career_talk_id) VALUES ('Missing scope', ?)", talk);
        rejected("""
                INSERT INTO task (title, person_id, raise_request_id)
                VALUES ('Wrong request scope', ?, ?)
                """, other, request);
        execute("INSERT INTO task (title) VALUES ('Unlinked')");
    }

    @Test
    void recurringTasksRequireScheduleAndHaveAtMostOneSuccessor() throws SQLException {
        rejected("INSERT INTO task (title, recurrence_frequency) VALUES ('Invalid', 'daily')");
        rejected("""
                INSERT INTO task (title, recurrence_frequency, recurrence_interval)
                VALUES ('Missing due date', 'daily', 1)
                """);
        rejected("""
                INSERT INTO task (title, due_at, recurrence_frequency, recurrence_interval)
                VALUES ('Invalid interval', '2026-01-01', 'daily', 0)
                """);
        long original = insert("""
                INSERT INTO task (title, due_at, recurrence_frequency, recurrence_interval)
                VALUES ('Fictitious recurrence', '2026-01-01', 'monthly', 1)
                """);
        execute("INSERT INTO task (title, source_task_id) VALUES ('Next', ?)", original);
        rejected("INSERT INTO task (title, source_task_id) VALUES ('Duplicate next', ?)", original);
        rejected("UPDATE task SET source_task_id = ? WHERE id = ?", original, original);
        rejected("INSERT INTO task (id, title, source_task_id) VALUES (900001, 'Self', 900001)");
        rejected("UPDATE task SET status = 'done' WHERE id = ?", original);
        execute("UPDATE task SET status = 'done', completed_at = '2026-01-01' WHERE id = ?", original);
    }

    @Test
    void notificationsAreTypedAndDeduplicated() throws SQLException {
        long task = insert("INSERT INTO task (title) VALUES ('Fictitious task')");
        execute("""
                INSERT INTO notification (kind, deduplication_key, task_id, triggered_at)
                VALUES ('task_due', 'task:1:due', ?, '2026-01-01')
                """, task);
        rejected("""
                INSERT INTO notification (kind, deduplication_key, task_id, triggered_at)
                VALUES ('task_due', 'task:1:due', ?, '2026-01-01')
                """, task);
        rejected("""
                INSERT INTO notification (kind, deduplication_key, person_id, triggered_at)
                VALUES ('task_due', 'wrong-kind', ?, '2026-01-01')
                """, person());
    }

    @Test
    void financialAuditIsScopedAndAppendOnly() throws SQLException {
        long person = person();
        long salary = salary(person, "50000");
        long actor = user();
        long event = insert("""
                INSERT INTO audit_event (actor_id, person_id, salary_id, action, changed_fields, occurred_at)
                VALUES (?, ?, ?, 'salary_created', 'amount,currency,effective_on', '2026-01-01')
                """, actor, person, salary);
        rejected("UPDATE audit_event SET changed_fields = 'reason' WHERE id = ?", event);
        rejected("DELETE FROM audit_event WHERE id = ?", event);
        rejected("""
                INSERT INTO audit_event (actor_id, person_id, salary_id, action, changed_fields, occurred_at)
                VALUES (?, ?, ?, 'salary_created', 'amount', '2026-01-01')
                """, actor, person(), salary);
    }

    @Test
    void singleAccountIsEnforcedAndEntitiesCanBeArchivedNotDeleted() throws SQLException {
        long actor = user();
        rejected("""
                INSERT INTO app_user (username, password_hash)
                VALUES ('second-fictitious-user', REPEAT('x', 60))
                """);
        rejected("""
                INSERT INTO app_user (singleton_key, username, password_hash)
                VALUES (2, 'second-fictitious-user', REPEAT('x', 60))
                """);
        long person = person();
        long contact = insert("INSERT INTO contact (person_id, type, value) VALUES (?, 'reference', 'fiction')", person);
        long base = salary(person, "50000");
        long request = raise(person, base);
        long talk = insert("INSERT INTO career_talk (person_id, held_at) VALUES (?, '2026-01-01')", person);
        long task = insert("INSERT INTO task (title) VALUES ('Fictitious')");
        long notification = insert("""
                INSERT INTO notification (kind, deduplication_key, person_id, triggered_at)
                VALUES ('career_talk_due', 'career:fiction', ?, '2026-01-01')
                """, person);
        for (String table : List.of("person", "contact", "raise_request", "career_talk", "task", "notification")) {
            execute("UPDATE " + table + " SET archived_at = '2026-02-01'");
            rejected("DELETE FROM " + table);
        }
        rejected("DELETE FROM app_user WHERE id = ?", actor);
        assertTrue(contact > 0 && request > 0 && talk > 0 && task > 0 && notification > 0);
    }

    private static Flyway flyway() {
        return Flyway.configure()
                .dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
                .locations("classpath:db/migration")
                .cleanDisabled(true)
                .load();
    }

    private long person() throws SQLException {
        return insert("""
                INSERT INTO person (first_name, last_name, hired_on)
                VALUES ('Fictitious', 'Person', '2026-01-01')
                """);
    }

    private long salary(long person, String amount) throws SQLException {
        return insert("""
                INSERT INTO salary (person_id, amount, currency, effective_on, reason)
                VALUES (?, ?, 'EUR', '2026-01-01', 'Fictitious salary')
                """, person, new BigDecimal(amount));
    }

    private long raise(long person, long salary) throws SQLException {
        return insert("""
                INSERT INTO raise_request
                  (person_id, base_salary_id, currency, requested_on, requested_salary, motivation)
                VALUES (?, ?, 'EUR', '2026-01-01', 55000, 'Fictitious request')
                """, person, salary);
    }

    private long user() throws SQLException {
        return insert("""
                INSERT INTO app_user (username, password_hash)
                VALUES ('fictitious-user', REPEAT('x', 60))
                """);
    }

    private SQLException rejected(String sql, Object... parameters) {
        SQLException exception = assertThrows(SQLException.class, () -> execute(sql, parameters));
        assertTrue(Set.of(1062, 1451, 1452, 1644, 3819).contains(exception.getErrorCode()),
                () -> "Expected a MySQL integrity/trigger failure, got error " + exception.getErrorCode());
        return exception;
    }

    private void execute(String sql, Object... parameters) throws SQLException {
        try (PreparedStatement statement = prepare(sql, parameters)) {
            statement.executeUpdate();
        }
    }

    private long insert(String sql, Object... parameters) throws SQLException {
        try (PreparedStatement statement = prepare(sql, parameters)) {
            statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                assertTrue(keys.next());
                return keys.getLong(1);
            }
        }
    }

    private long scalar(String sql, Object... parameters) throws SQLException {
        try (PreparedStatement statement = prepare(sql, parameters);
                ResultSet result = statement.executeQuery()) {
            assertTrue(result.next());
            return result.getLong(1);
        }
    }

    private PreparedStatement prepare(String sql, Object... parameters) throws SQLException {
        PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
        try {
            for (int i = 0; i < parameters.length; i++) {
                statement.setObject(i + 1, parameters[i]);
            }
            return statement;
        } catch (SQLException exception) {
            statement.close();
            throw exception;
        }
    }
}
