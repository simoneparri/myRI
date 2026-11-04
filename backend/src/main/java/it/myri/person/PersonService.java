package it.myri.person;

import it.myri.auth.AppUserRepository;
import it.myri.common.*;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PersonService {
    private final PersonRepository people;
    private final AppUserRepository users;
    private final Clock clock;
    private final ZoneId zone;

    public PersonService(PersonRepository people, AppUserRepository users, Clock clock, ZoneId zone) {
        this.people = people;
        this.users = users;
        this.clock = clock;
        this.zone = zone;
    }

    @Transactional(readOnly = true)
    public PageResponse<PersonDtos.View> list(String q, String status, Long managerId,
            boolean includeArchived, int page, int size, String sort) {
        Queries.value(status, Set.of("active", "inactive"));
        return PageResponse.of(people.findAll(Queries.<Person>visible(includeArchived)
                .and(Queries.text(q, "firstName", "lastName", "email", "role"))
                .and(Queries.equal("status", status)).and(Queries.equal("managerId", managerId)),
                Queries.page(page, size, sort, Set.of("id", "lastName", "firstName", "hiredOn", "createdAt"))),
                this::view);
    }

    @Transactional(readOnly = true)
    public Person get(Long id) {
        return people.findById(id).orElseThrow(ApiException::missing);
    }

    public PersonDtos.View view(Person person) {
        return PersonMapper.view(person, LocalDate.now(clock.withZone(zone)));
    }

    @Transactional(readOnly = true)
    public Person requireUsable(Long id) {
        Person person = get(id);
        Queries.editable(person);
        return person;
    }

    public PersonDtos.View create(PersonDtos.Input input) {
        users.lockSingleton().orElseThrow(ApiException::missing);
        validateManager(null, input);
        Person person = new Person();
        person.initialize(clock);
        PersonMapper.apply(person, input);
        return view(people.saveAndFlush(person));
    }

    public PersonDtos.View update(Long id, PersonDtos.Input input) {
        // The singleton lock serializes changes to the complete manager graph.
        users.lockSingleton().orElseThrow(ApiException::missing);
        Person person = requireUsable(id);
        Queries.version(person, input.version());
        validateManager(id, input);
        PersonMapper.apply(person, input);
        person.touch(clock);
        return view(people.saveAndFlush(person));
    }

    public PersonDtos.View archive(Long id, Long version) {
        Person person = get(id);
        person.archive(version, clock);
        return view(people.saveAndFlush(person));
    }

    private void validateManager(Long id, PersonDtos.Input input) {
        Dates.check(input.hiredOn());
        if (input.managerId() != null && input.externalManager() != null) {
            throw ApiException.invalid("Scegliere manager interno oppure esterno.");
        }
        Set<Long> visited = new HashSet<>();
        Long cursor = input.managerId();
        if (cursor != null) {
            requireUsable(cursor);
        }
        while (cursor != null) {
            if (Objects.equals(id, cursor) || !visited.add(cursor)) {
                throw ApiException.conflict("Il rapporto gerarchico introdurrebbe un ciclo.");
            }
            cursor = get(cursor).managerId;
        }
    }
}
