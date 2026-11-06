package it.myri.person;

import java.time.LocalDate;
import java.time.Period;
import java.util.List;

public final class PersonMapper {
    private PersonMapper() {}

    public static PersonDtos.View view(Person p, LocalDate today) {
        return new PersonDtos.View(p.id, p.firstName, p.lastName, p.email, p.phone,
                p.role, p.hiredOn, elapsed(p.hiredOn, today), p.hiringLocation, p.residence, p.managerId,
                p.externalManager, p.notes, p.status, p.archivedAt, p.createdAt,
                p.updatedAt, p.version, p.careerStartedOn, elapsed(p.careerStartedOn, today),
                p.seniorityLevel, p.mypadId, p.frameworks == null ? List.of() : List.copyOf(p.frameworks),
                p.bornOn, p.bornOn == null ? null : Period.between(p.bornOn, today).getYears(),
                p.rsnoAgresso, p.insideId, p.education, p.capacityManagement);
    }

    private static String elapsed(LocalDate start, LocalDate today) {
        if (start == null) return null;
        if (start.isAfter(today)) return "data futura";
        Period tenure = Period.between(start, today);
        String yearLabel = tenure.getYears() == 1 ? "anno" : "anni";
        String monthLabel = tenure.getMonths() == 1 ? "mese" : "mesi";
        return "%d %s e %d %s".formatted(
                tenure.getYears(), yearLabel, tenure.getMonths(), monthLabel);
    }

    public static void apply(Person p, PersonDtos.Input input) {
        p.firstName = input.firstName().strip();
        p.lastName = input.lastName().strip();
        p.email = input.email();
        p.phone = input.phone();
        p.role = input.role();
        if (input.frameworks() != null) {
            p.frameworks = input.frameworks().stream().map(String::strip).toList();
        }
        p.hiredOn = input.hiredOn();
        p.bornOn = input.bornOn();
        p.careerStartedOn = input.careerStartedOn();
        p.seniorityLevel = input.seniorityLevel();
        p.mypadId = input.mypadId();
        p.rsnoAgresso = input.rsnoAgresso() == null ? null : input.rsnoAgresso().strip();
        p.insideId = input.insideId() == null ? null : input.insideId().strip();
        p.education = input.education();
        p.hiringLocation = input.hiringLocation();
        p.residence = input.residence();
        p.managerId = input.managerId();
        p.externalManager = input.externalManager();
        p.notes = input.notes();
        p.capacityManagement = input.capacityManagement();
        p.status = input.status();
    }
}
