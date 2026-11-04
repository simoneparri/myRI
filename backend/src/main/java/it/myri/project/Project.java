package it.myri.project;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.time.LocalDate;

@Entity
public class Project extends MutableEntity {
    public Long personId;
    @Column(length = 200)
    public String client;
    public LocalDate startsOn;
    public LocalDate endsOn;
    @Column(length = 200)
    public String businessManager;
    @Column(length = 10)
    public String workMode;
    @Column(columnDefinition = "text")
    public String notes;
}
