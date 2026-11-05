package it.myri.person;

import it.myri.auth.AppUserRepository;
import it.myri.common.*;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
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
        if (input.mypadId() == null || input.mypadId().isBlank()) {
            throw ApiException.invalid("MyPad ID obbligatorio per il censimento.");
        }
        if (input.bornOn() == null) {
            throw ApiException.invalid("La data di nascita e obbligatoria per il censimento.");
        }
        requireMetadata(input);
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
        if (person.mypadId != null && input.mypadId() == null) {
            throw ApiException.invalid("MyPad ID obbligatorio per questa persona.");
        }
        if (person.bornOn != null && input.bornOn() == null) {
            throw ApiException.invalid("La data di nascita e obbligatoria per questa persona.");
        }
        if ((person.rsnoAgresso != null && input.rsnoAgresso() == null)
                || (person.insideId != null && input.insideId() == null)
                || (person.education != null && input.education() == null)) {
            throw ApiException.invalid("I codici e l'educazione gia assegnati non possono essere svuotati.");
        }
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
        validateMetadata(id, input);
        validateFrameworks(input.frameworks());
        Dates.check(input.hiredOn());
        Dates.check(input.bornOn());
        if (input.bornOn() != null && input.bornOn().isAfter(LocalDate.now(clock.withZone(zone)))) {
            throw ApiException.invalid("La data di nascita non puo essere futura.");
        }
        Dates.check(input.careerStartedOn());
        if (input.careerStartedOn() != null && input.careerStartedOn().isAfter(input.hiredOn())) {
            throw ApiException.invalid("L'inizio lavoro non puo essere successivo all'assunzione.");
        }
        Queries.value(input.seniorityLevel(), Set.of("junior", "medior", "senior"));
        if (input.mypadId() != null) {
            if (!input.mypadId().matches("[A-Za-z0-9_-]{1,100}")) {
                throw ApiException.invalid("Formato MyPad ID non valido.");
            }
            if (id == null ? people.existsByMypadId(input.mypadId())
                    : people.existsByMypadIdAndIdNot(input.mypadId(), id)) {
                throw ApiException.conflict("MyPad ID gia assegnato a un'altra persona.");
            }
        }
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

    private static void requireMetadata(PersonDtos.Input input) {
        if (input.rsnoAgresso() == null || input.rsnoAgresso().isBlank()
                || input.insideId() == null || input.insideId().isBlank() || input.education() == null) {
            throw ApiException.invalid("RSNO Agresso, Inside ID ed educazione obbligatori per il censimento.");
        }
    }

    private void validateMetadata(Long id, PersonDtos.Input input) {
        Queries.value(input.education(), Set.of("diploma", "bachelor", "master", "phd"));
        String rsno = input.rsnoAgresso();
        String inside = input.insideId();
        for (String code : new String[] { rsno, inside }) {
            if (code != null && (code.isBlank() || code.length() > 100
                    || code.indexOf('\n') >= 0 || code.indexOf('\r') >= 0)) {
                throw ApiException.invalid("I codici devono contenere da 1 a 100 caratteri su una sola riga.");
            }
        }
        if (rsno != null && (id == null ? people.existsByRsnoAgresso(rsno.strip())
                : people.existsByRsnoAgressoAndIdNot(rsno.strip(), id))) {
            throw ApiException.conflict("RSNO Agresso gia assegnato a un'altra persona.");
        }
        if (inside != null && (id == null ? people.existsByInsideId(inside.strip())
                : people.existsByInsideIdAndIdNot(inside.strip(), id))) {
            throw ApiException.conflict("Inside ID gia assegnato a un'altra persona.");
        }
    }

    private static void validateFrameworks(List<String> frameworks) {
        if (frameworks == null) return;
        Set<String> normalized = new HashSet<>();
        for (String framework : frameworks) {
            if (framework == null || framework.isBlank() || framework.length() > 100
                    || framework.indexOf('\n') >= 0 || framework.indexOf('\r') >= 0) {
                throw ApiException.invalid("Ogni framework deve contenere da 1 a 100 caratteri su una sola riga.");
            }
            if (!normalized.add(framework.strip().toLowerCase(Locale.ROOT))) {
                throw ApiException.invalid("I framework conosciuti non possono contenere duplicati.");
            }
        }
        if (frameworks.size() > 50) {
            throw ApiException.invalid("Puoi indicare al massimo 50 framework.");
        }
    }
}
