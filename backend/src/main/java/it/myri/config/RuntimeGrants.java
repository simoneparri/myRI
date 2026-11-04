package it.myri.config;

import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.callback.Callback;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RuntimeGrants {
    @Bean
    FlywayConfigurationCustomizer grants(@Value("${spring.datasource.username}") String runtimeUser,
            @Value("${spring.flyway.user}") String migrationUser) {
        if (!runtimeUser.matches("[a-z][a-z0-9_]{0,31}") || runtimeUser.equals("root")
                || !migrationUser.matches("[a-z][a-z0-9_]{0,31}") || migrationUser.equals("root")
                || runtimeUser.equals(migrationUser)) {
            throw new IllegalStateException("Richieste utenze DB distinte non root con nomi lowercase ASCII.");
        }
        return configuration -> configuration.callbacks(new Callback() {
            @Override public boolean supports(Event event, Context context) { return event == Event.AFTER_MIGRATE; }
            @Override public boolean canHandleInTransaction(Event event, Context context) { return false; }
            @Override public String getCallbackName() { return "runtime-table-grants"; }
            @Override public void handle(Event event, Context context) {
                try {
                    String database = context.getConnection().getCatalog();
                    if (database == null || !database.matches("[a-z][a-z0-9_]{0,63}")) {
                        throw new FlywayException("Nome database non valido per i privilegi runtime.");
                    }
                    try (Statement statement = context.getConnection().createStatement()) {
                        for (String table : List.of("app_user", "person", "contact", "raise_request",
                                "career_talk", "task", "notification", "salary", "audit_event", "project")) {
                            String privileges = List.of("salary", "audit_event").contains(table)
                                    ? "SELECT, INSERT" : "SELECT, INSERT, UPDATE";
                            statement.execute("GRANT " + privileges + " ON `" + database + "`.`" + table
                                    + "` TO '" + runtimeUser + "'@'%'");
                        }
                    }
                } catch (SQLException exception) {
                    throw new FlywayException("Impossibile assegnare i privilegi alle tabelle runtime.");
                }
            }
        });
    }
}
