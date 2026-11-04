package it.myri.person;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.time.LocalDate;

@Entity
public class Person extends MutableEntity {
    public String firstName;
    public String lastName;
    public String email;
    public String phone;
    public String role;
    public LocalDate hiredOn;
    public LocalDate careerStartedOn;
    @Column(length = 10)
    public String seniorityLevel;
    @Column(length = 100)
    public String mypadId;
    @Column(length = 200)
    public String hiringLocation;
    @Column(length = 500)
    public String residence;
    public Long managerId;
    public String externalManager;
    @Column(columnDefinition = "text")
    public String notes;
    public String status;
}
