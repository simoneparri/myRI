package it.myri.config;

import it.myri.auth.*;
import it.myri.careertalk.*;
import it.myri.contact.*;
import it.myri.person.*;
import it.myri.raiserequest.*;
import it.myri.salary.*;
import it.myri.task.*;
import java.math.BigDecimal;
import java.time.*;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
@Profile("dev")
public class DevSeed {
    @Bean
    @Order(10)
    ApplicationRunner seed(PersonRepository repository, PersonService people, ContactService contacts,
            SalaryService salaries, RaiseService raises, CareerTalkService talks, TaskService tasks,
            AppUserRepository users, TransactionTemplate transaction, Clock clock, ZoneId zone,
            @org.springframework.beans.factory.annotation.Value("${myri.reset-password}") boolean reset) {
        return arguments -> {
            if (reset) { return; }
            transaction.executeWithoutResult(status -> {
                users.lockSingleton().orElseThrow();
                if (repository.count() != 0) { return; }
                var previous = SecurityContextHolder.getContext();
                var context = SecurityContextHolder.createEmptyContext();
                AccountPrincipal actor = new AccountPrincipal(users.findBySingletonKey((byte) 1).orElseThrow());
                actor.eraseCredentials();
                context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                        actor, null, actor.getAuthorities()));
                SecurityContextHolder.setContext(context);
                try {
                    LocalDate today = LocalDate.now(clock.withZone(zone));
                    var person = people.create(new PersonDtos.Input("Ada", "Esempio", "ada@example.invalid",
                            null, "Software Engineer", today.minusYears(2), "Sede fittizia",
                            "Residenza fittizia", null,
                            "Manager fittizio", "Persona completamente fittizia.", "active", null,
                            today.minusYears(5), "medior", "dev-fictitious-ada",
                            java.util.List.of("Java", "Spring Boot"), today.minusYears(30),
                            "dev-agresso-001", "dev-inside-001", "master"));
                    contacts.create(person.id(), new ContactDtos.Input("reference", "Contatto fittizio", null, null, today));
                    var base = salaries.create(person.id(), new SalaryDtos.Input(new BigDecimal("50000.00"),
                            "EUR", today.minusYears(1), "Tempo indeterminato", new BigDecimal("40.00"),
                            "Livello fittizio", "Dati fittizi di sviluppo", "dev-initial-salary"));
                    raises.create(new RaiseDtos.Input(person.id(), base.id(), today,
                            new BigDecimal("55000.00"), new BigDecimal("10.0000"),
                            "Richiesta fittizia", null));
                    var talk = talks.create(new CareerTalkDtos.Input(person.id(), clock.instant().minus(Duration.ofDays(30)),
                            "Crescita professionale fittizia", "Obiettivi di esempio",
                            null, null, "Pianificare formazione", today.plusMonths(2), null));
                    tasks.create(new TaskDtos.Input("Follow-up di esempio", "Task fittizio",
                            clock.instant().plus(Duration.ofDays(2)), "medium", "todo", person.id(),
                            talk.id(), null, null, null, null));
                } finally {
                    SecurityContextHolder.setContext(previous);
                }
            });
        };
    }
}
