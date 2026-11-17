package it.myri.schema;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.ArrayList;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;

class SqlUtilitiesTest {
    @Test
    void deletionRequiresExplicitDevConfirmationAndRestoresNoOtherPersonsData() throws Exception {
        try (var mysql = new MySQLContainer<>("mysql:8")
                .withDatabaseName("myri_utility_test").withUsername("utility_test")
                .withPassword("ephemeral-test-only")
                .withCommand("--log-bin-trust-function-creators=1")) {
            mysql.start();
            Flyway.configure().dataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword())
                    .locations("classpath:db/migration").load().migrate();
            try (var connection = DriverManager.getConnection(mysql.getJdbcUrl(), "root", mysql.getPassword());
                    var sql = connection.createStatement()) {
                String script = Files.readString(Path.of("../scripts/sql-utilities/delete-person-dev.sql"));
                String procedure = script.substring(script.indexOf("CREATE PROCEDURE"), script.indexOf("\nEND$$") + 4);
                sql.execute(procedure);
                sql.execute("""
                        INSERT INTO person(id,first_name,last_name,hired_on) VALUES
                        (1001,'Persona','Fittizia','2020-01-01'),(1002,'Altra','Fittizia','2020-01-01')
                        """);
                sql.execute("SET @person_id=1001");
                assertThrows(SQLException.class, () -> sql.execute("CALL myri_delete_person_dev()"));
                sql.execute("SET @myri_dev_database_confirm='fictitious-data-only'");
                // Production triggers cannot be bypassed implicitly by this utility.
                assertThrows(SQLException.class, () -> sql.execute("CALL myri_delete_person_dev()"));
                var triggers = new ArrayList<String>();
                try (var rows = sql.executeQuery("SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema=DATABASE()")) {
                    while (rows.next()) triggers.add(rows.getString(1));
                }
                for (String trigger : triggers) sql.execute("DROP TRIGGER `" + trigger + "`");
                sql.execute("SET @person_id='1001 OR 1=1'");
                assertThrows(SQLException.class, () -> sql.execute("CALL myri_delete_person_dev()"));
                sql.execute("SET @person_id=999999");
                assertThrows(SQLException.class, () -> sql.execute("CALL myri_delete_person_dev()"));
                sql.execute("CREATE DATABASE utility_guard");
                sql.execute("USE utility_guard");
                sql.execute(procedure);
                sql.execute("SET @person_id=1001");
                assertThrows(SQLException.class, () -> sql.execute("CALL myri_delete_person_dev()"));
                sql.execute("USE myri_utility_test");
                sql.execute("UPDATE person SET manager_id=1001 WHERE id=1002");
                sql.execute("""
                        INSERT INTO salary(id,person_id,amount,currency,effective_on,reason) VALUES
                        (1001,1001,40000,'EUR','2025-01-01','Fittizio'),
                        (1002,1002,40000,'EUR','2025-01-01','Fittizio')
                        """);
                sql.execute("""
                        INSERT INTO raise_request(id,person_id,base_salary_id,currency,requested_on,requested_salary,motivation)
                        VALUES(1001,1001,1001,'EUR','2026-01-01',44000,'Fittizio')
                        """);
                sql.execute("""
                        INSERT INTO salary(id,person_id,amount,currency,effective_on,reason,source_raise_request_id)
                        VALUES(1003,1001,44000,'EUR','2026-02-01','Fittizio',1001)
                        """);
                sql.execute("INSERT INTO career_talk(id,person_id,held_at) VALUES(1001,1001,UTC_TIMESTAMP())");
                sql.execute("""
                        INSERT INTO task(id,person_id,title,career_talk_id,raise_request_id)
                        VALUES(1001,1001,'Fittizio',1001,1001),(1002,1002,'Altro fittizio',NULL,NULL)
                        """);
                sql.execute("INSERT INTO task(id,person_id,title,source_task_id) VALUES(1003,1001,'Fittizio',1001)");
                sql.execute("""
                        INSERT INTO notification(kind,deduplication_key,task_id,triggered_at)
                        VALUES('task_due','fittizio-1001',1001,UTC_TIMESTAMP()),
                        ('task_due','fittizio-1002',1002,UTC_TIMESTAMP())
                        """);
                sql.execute("INSERT INTO contact(person_id,type,value) VALUES(1001,'chat','Fittizio'),(1002,'chat','Fittizio')");
                sql.execute("""
                        INSERT INTO project(person_id,client,work_mode,created_at,updated_at)
                        VALUES(1001,'Fittizio','remote',UTC_TIMESTAMP(),UTC_TIMESTAMP())
                        """);
                sql.execute("""
                        INSERT INTO app_user(id,username,password_hash) VALUES(1001,'Fittizio',REPEAT('x',60))
                        """);
                sql.execute("""
                        INSERT INTO audit_event(actor_id,person_id,salary_id,action,changed_fields,occurred_at)
                        VALUES(1001,1001,1001,'salary_created','amount',UTC_TIMESTAMP())
                        """);
                // An unexpected external FK forces rollback of every preceding DELETE/UPDATE.
                sql.execute("CREATE TABLE utility_blocker(person_id BIGINT, FOREIGN KEY(person_id) REFERENCES person(id))");
                sql.execute("INSERT INTO utility_blocker VALUES(1001)");
                assertThrows(SQLException.class, () -> sql.execute("CALL myri_delete_person_dev()"));
                assertEquals(2, scalar(sql, "SELECT COUNT(*) FROM contact"));
                assertEquals(3, scalar(sql, "SELECT COUNT(*) FROM salary"));
                sql.execute("DROP TABLE utility_blocker");
                sql.execute("CALL myri_delete_person_dev()");
                for (String table : new String[] {"contact", "project", "salary", "raise_request", "career_talk", "task", "audit_event"}) {
                    assertEquals(0, scalar(sql, "SELECT COUNT(*) FROM " + table + " WHERE person_id=1001"), table);
                }
                assertEquals(0, scalar(sql, "SELECT COUNT(*) FROM person WHERE id=1001"));
                assertEquals(1, scalar(sql, "SELECT COUNT(*) FROM person WHERE id=1002 AND manager_id IS NULL"));
                assertEquals(1, scalar(sql, "SELECT COUNT(*) FROM contact WHERE person_id=1002"));
                assertEquals(1, scalar(sql, "SELECT COUNT(*) FROM salary WHERE person_id=1002"));
                assertEquals(1, scalar(sql, "SELECT COUNT(*) FROM notification WHERE task_id=1002"));
                assertEquals(0, scalar(sql, "SELECT COUNT(*) FROM notification WHERE task_id=1001"));
                sql.execute("DROP PROCEDURE myri_delete_person_dev");
            }
        }
    }

    private static int scalar(Statement sql, String query) throws SQLException {
        try (ResultSet rows = sql.executeQuery(query)) {
            assertTrue(rows.next());
            return rows.getInt(1);
        }
    }
}
