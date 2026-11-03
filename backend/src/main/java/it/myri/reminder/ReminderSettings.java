package it.myri.reminder;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("myri.reminders")
public record ReminderSettings(@Min(1) @Max(120) int careerMonths,
        @Min(1000) @Max(86400000) long intervalMs) {}
