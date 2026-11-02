package it.myri.contact;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

@Entity
public class Contact extends MutableEntity {
    public Long personId;
    public String type;
    public String value;
    @Column(columnDefinition = "text")
    public String notes;
}
