package it.myri.contact;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.time.LocalDate;

@Entity
public class Contact extends MutableEntity {
    public Long personId;
    public String type;
    public String value;
    public LocalDate contactedOn;
    @Column(columnDefinition = "text")
    public String notes;
}
