package it.myri.contact;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import it.myri.common.ApiException;
import it.myri.person.PersonService;
import java.time.Clock;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ContactServiceTest {
    private final ContactRepository contacts = mock(ContactRepository.class);
    private final PersonService people = mock(PersonService.class);
    private final ContactService service = new ContactService(contacts, people, Clock.systemUTC());

    @Test
    void updateChecksVersionAndArchivedStateBeforeApplyingInput() {
        Contact contact = new Contact();
        contact.id = 1L;
        contact.personId = 2L;
        contact.version = 3L;
        when(contacts.findById(1L)).thenReturn(Optional.of(contact));
        assertThrows(ApiException.class, () -> service.update(1L,
                new ContactDtos.Input("reference", "Fictitious", null, 2L)));
        assertNull(contact.value);
        verify(contacts, never()).saveAndFlush(any());
    }
}
