package it.myri.careertalk;

import it.myri.common.*;
import it.myri.person.PersonService;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CareerTalkService {
    private final CareerTalkRepository talks;
    private final PersonService people;
    private final Clock clock;

    public CareerTalkService(CareerTalkRepository talks, PersonService people, Clock clock) {
        this.talks = talks;
        this.people = people;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<CareerTalkDtos.View> list(Long personId, String q, Instant from, Instant to,
            boolean includeArchived, int page, int size, String sort) {
        return PageResponse.of(talks.findAll(Queries.<CareerTalk>visible(includeArchived)
                .and(Queries.equal("personId", personId)).and(Queries.text(q, "topics", "agreedGoals"))
                .and(Queries.between("heldAt", from, to)),
                Queries.page(page, size, sort, Set.of("id", "heldAt", "createdAt"))), CareerTalkDtos::view);
    }

    @Transactional(readOnly = true)
    public CareerTalk get(Long id) { return talks.findById(id).orElseThrow(ApiException::missing); }

    public CareerTalkDtos.View create(CareerTalkDtos.Input input) {
        people.requireUsable(input.personId());
        Dates.check(input.heldAt());
        Dates.check(input.suggestedNextOn());
        CareerTalk talk = new CareerTalk();
        talk.initialize(clock);
        CareerTalkDtos.apply(talk, input);
        return CareerTalkDtos.view(talks.saveAndFlush(talk));
    }

    public CareerTalkDtos.View update(Long id, CareerTalkDtos.Input input) {
        Dates.check(input.heldAt());
        Dates.check(input.suggestedNextOn());
        CareerTalk talk = get(id);
        Queries.editable(talk);
        Queries.version(talk, input.version());
        people.requireUsable(talk.personId);
        if (!Objects.equals(talk.personId, input.personId())) {
            throw ApiException.conflict("La persona del career talk non e modificabile.");
        }
        CareerTalkDtos.apply(talk, input);
        talk.touch(clock);
        return CareerTalkDtos.view(talks.saveAndFlush(talk));
    }

    public CareerTalkDtos.View archive(Long id, Long version) {
        CareerTalk talk = get(id);
        talk.archive(version, clock);
        return CareerTalkDtos.view(talks.saveAndFlush(talk));
    }
}
