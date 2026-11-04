package it.myri.person;

import java.time.LocalDate;
import java.time.Period;

public final class PersonMapper {
    private PersonMapper() {}

    public static PersonDtos.View view(Person p, LocalDate today) {
        Period tenure = p.hiredOn.isAfter(today) ? Period.ZERO : Period.between(p.hiredOn, today);
        String yearLabel = tenure.getYears() == 1 ? "anno" : "anni";
        String monthLabel = tenure.getMonths() == 1 ? "mese" : "mesi";
        String seniority = "%d %s e %d %s".formatted(
                tenure.getYears(), yearLabel, tenure.getMonths(), monthLabel);
        return new PersonDtos.View(p.id, p.firstName, p.lastName, p.email, p.phone,
                p.role, p.hiredOn, seniority, p.hiringLocation, p.residence, p.managerId,
                p.externalManager, p.notes, p.status, p.archivedAt, p.createdAt,
                p.updatedAt, p.version);
    }

    public static void apply(Person p, PersonDtos.Input input) {
        p.firstName = input.firstName().strip();
        p.lastName = input.lastName().strip();
        p.email = input.email();
        p.phone = input.phone();
        p.role = input.role();
        p.hiredOn = input.hiredOn();
        p.hiringLocation = input.hiringLocation();
        p.residence = input.residence();
        p.managerId = input.managerId();
        p.externalManager = input.externalManager();
        p.notes = input.notes();
        p.status = input.status();
    }
}
