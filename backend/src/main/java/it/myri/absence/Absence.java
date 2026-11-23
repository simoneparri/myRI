package it.myri.absence;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.time.LocalDateTime;

@Entity
public class Absence extends MutableEntity {
    @Column(nullable = false)
    public Long personId;
    @Column(nullable = false)
    public LocalDateTime startsAt;
    @Column(nullable = false)
    public LocalDateTime endsAt;
    @Column(nullable = false, length = 100)
    public String absenceCode;
    @Column(nullable = false, length = 255)
    public String absenceLabel;
    @Column(nullable = false, length = 100)
    public String workflowStatus;
    @Column(nullable = false, length = 50)
    public String days;
    @Column(nullable = false, length = 50)
    public String hours;
    @Column(nullable = false, length = 100)
    public String importedToTimesheet;
}
