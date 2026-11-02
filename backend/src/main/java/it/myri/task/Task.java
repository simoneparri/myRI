package it.myri.task;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.time.Instant;

@Entity
public class Task extends MutableEntity {
    public String title;
    @Column(columnDefinition = "text") public String description;
    public Instant dueAt;
    public String priority;
    public String status;
    public Long personId;
    public Long careerTalkId;
    public Long raiseRequestId;
    public String recurrenceFrequency;
    public Integer recurrenceInterval;
    public Long sourceTaskId;
    public Instant completedAt;
}
