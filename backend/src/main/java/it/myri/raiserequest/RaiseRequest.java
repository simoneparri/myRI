package it.myri.raiserequest;

import it.myri.common.MutableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
public class RaiseRequest extends MutableEntity {
    public Long personId;
    public Long baseSalaryId;
    @Column(columnDefinition = "char(3)") public String currency;
    public LocalDate requestedOn;
    @Column(precision = 12, scale = 2) public BigDecimal requestedSalary;
    @Column(precision = 9, scale = 4) public BigDecimal requestedPercentage;
    @Column(columnDefinition = "text") public String motivation;
    public String status;
    public LocalDate outcomeOn;
    @Column(columnDefinition = "text") public String outcomeNotes;
    public boolean benefitsSpecified;
    public Boolean mealVouchers;
    @Column(precision = 12, scale = 2) public BigDecimal bonusLetterAmount;
    public Boolean companyCar;
}
