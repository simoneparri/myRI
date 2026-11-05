package it.myri.contact;

import it.myri.common.*;
import it.myri.person.PersonService;
import java.time.Clock;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ContactService {
    private final ContactRepository contacts;
    private final PersonService people;
    private final Clock clock;

    public ContactService(ContactRepository contacts, PersonService people, Clock clock) {
        this.contacts = contacts;
        this.people = people;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<ContactDtos.View> list(Long personId, String q, String type,
            boolean includeArchived, int page, int size, String sort) {
        people.get(personId);
        return PageResponse.of(contacts.findAll(Queries.<Contact>visible(includeArchived)
                .and(Queries.equal("personId", personId)).and(Queries.equal("type", type))
                .and(Queries.text(q, "type", "value")),
                Queries.page(page, size, sort, Set.of("id", "type", "createdAt", "contactedOn"))), ContactDtos::view);
    }

    @Transactional(readOnly = true)
    public Contact get(Long id) { return contacts.findById(id).orElseThrow(ApiException::missing); }

    public ContactDtos.View create(Long personId, ContactDtos.Input input) {
        people.requireUsable(personId);
        if (input.contactedOn() == null) {
            throw ApiException.invalid("La data di contatto e obbligatoria.");
        }
        Contact contact = new Contact();
        contact.personId = personId;
        contact.initialize(clock);
        ContactDtos.apply(contact, input);
        return ContactDtos.view(contacts.saveAndFlush(contact));
    }

    public ContactDtos.View update(Long id, ContactDtos.Input input) {
        Contact contact = get(id);
        people.requireUsable(contact.personId);
        Queries.editable(contact);
        Queries.version(contact, input.version());
        if (contact.contactedOn != null && input.contactedOn() == null) {
            throw ApiException.invalid("La data di contatto e obbligatoria.");
        }
        ContactDtos.apply(contact, input);
        contact.touch(clock);
        return ContactDtos.view(contacts.saveAndFlush(contact));
    }

    public ContactDtos.View archive(Long id, Long version) {
        Contact contact = get(id);
        contact.archive(version, clock);
        return ContactDtos.view(contacts.saveAndFlush(contact));
    }
}
