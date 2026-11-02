package it.myri.careertalk;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.time.Instant;
import java.time.LocalDate;

@Entity
public class CareerTalk extends MutableEntity {
    public Long personId;
    public Instant heldAt;
    @Column(columnDefinition = "text") public String topics;
    @Column(columnDefinition = "text") public String agreedGoals;
    @Column(columnDefinition = "text") public String feedbackGiven;
    @Column(columnDefinition = "text") public String feedbackReceived;
    @Column(columnDefinition = "text") public String nextSteps;
    public LocalDate suggestedNextOn;
}
