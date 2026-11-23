package it.myri.absence;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.time.LocalDate;

@Entity
public class CompanyClosure extends MutableEntity {
    @Column(nullable = false)
    public LocalDate closedOn;
}
