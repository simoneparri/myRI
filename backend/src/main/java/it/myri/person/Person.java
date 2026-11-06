package it.myri.person;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.util.ArrayList;
import java.util.List;
import java.time.LocalDate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
public class Person extends MutableEntity {
    public String firstName;
    public String lastName;
    public String email;
    public String phone;
    public String role;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json", nullable = false)
    public List<String> frameworks = new ArrayList<>();
    public LocalDate hiredOn;
    public LocalDate bornOn;
    public LocalDate careerStartedOn;
    @Column(length = 10)
    public String seniorityLevel;
    @Column(length = 100)
    public String mypadId;
    @Column(length = 100)
    public String rsnoAgresso;
    @Column(length = 100)
    public String insideId;
    @Column(length = 20)
    public String education;
    @Column(length = 200)
    public String hiringLocation;
    @Column(length = 500)
    public String residence;
    public Long managerId;
    public String externalManager;
    @Column(columnDefinition = "text")
    public String notes;
    @Column(columnDefinition = "text")
    public String capacityManagement;
    public String status;
}
