package it.myri.person;

public final class PersonMapper {
    private PersonMapper() {}

    public static PersonDtos.View view(Person p) {
        return new PersonDtos.View(p.id, p.firstName, p.lastName, p.email, p.phone,
                p.role, p.seniority, p.hiredOn, p.managerId, p.externalManager, p.notes,
                p.status, p.archivedAt, p.createdAt, p.updatedAt, p.version);
    }

    public static void apply(Person p, PersonDtos.Input input) {
        p.firstName = input.firstName().strip();
        p.lastName = input.lastName().strip();
        p.email = input.email();
        p.phone = input.phone();
        p.role = input.role();
        p.seniority = input.seniority();
        p.hiredOn = input.hiredOn();
        p.managerId = input.managerId();
        p.externalManager = input.externalManager();
        p.notes = input.notes();
        p.status = input.status();
    }
}
