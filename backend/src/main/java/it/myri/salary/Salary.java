package it.myri.salary;

import it.myri.common.PersistentEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
public class Salary extends PersistentEntity {
    public Long personId;
    @Column(precision = 12, scale = 2)
    public BigDecimal amount;
    @Column(columnDefinition = "char(3)")
    public String currency;
    public LocalDate effectiveOn;
    @Column(length = 100)
    public String contractType;
    @Column(precision = 5, scale = 2)
    public BigDecimal weeklyHours;
    @Column(length = 100)
    public String classificationLevel;
    @Column(columnDefinition = "text")
    public String reason;
    public Long sourceRaiseRequestId;
    public String requestKey;
    public Boolean mealVouchers;
    @Column(precision = 12, scale = 2)
    public BigDecimal bonusLetterAmount;
    public Boolean companyCar;
}
