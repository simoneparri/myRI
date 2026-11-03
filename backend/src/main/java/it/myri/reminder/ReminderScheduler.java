package it.myri.reminder;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@EnableConfigurationProperties(ReminderSettings.class)
public class ReminderScheduler {
    @org.springframework.context.annotation.Bean
    @ConditionalOnExpression("${myri.reminders.enabled:true} && !${myri.reset-password:false}")
    Runner reminderRunner(ReminderService service) { return new Runner(service); }

    public static class Runner {
        private final ReminderService service;
        Runner(ReminderService service) { this.service = service; }
        @Scheduled(fixedDelayString = "${myri.reminders.interval-ms}", initialDelayString = "${myri.reminders.interval-ms}")
        public void run() { service.generate(); }
    }
}
