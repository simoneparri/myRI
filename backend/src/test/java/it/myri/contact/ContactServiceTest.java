package it.myri.contact;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import it.myri.common.ApiException;
import it.myri.person.PersonService;
import java.time.Clock;
import java.time.LocalDate;
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
                new ContactDtos.Input("reference", "Fictitious", null, 2L, null)));
        assertNull(contact.value);
        verify(contacts, never()).saveAndFlush(any());
    }

    @Test
    void createRequiresContactDateAndMapsItToTheView() {
        assertThrows(ApiException.class, () -> service.create(2L,
                new ContactDtos.Input("reference", "Fictitious", null, null, null)));
        verify(contacts, never()).saveAndFlush(any());
        when(contacts.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        LocalDate date = LocalDate.of(2026, 11, 5);
        var view = service.create(2L, new ContactDtos.Input("reference", "Fictitious", null, null, date));
        assertEquals(date, view.contactedOn());
        assertThrows(ApiException.class, () -> service.create(2L,
                new ContactDtos.Input("reference", "Fictitious", null, null, LocalDate.of(999, 1, 1))));
    }

    @Test
    void legacyContactCanRemainUndatedButAnAssignedDateCannotBeCleared() {
        Contact contact = new Contact();
        contact.personId = 2L;
        contact.version = 0L;
        when(contacts.findById(1L)).thenReturn(Optional.of(contact));
        when(contacts.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertNull(service.update(1L,
                new ContactDtos.Input("reference", "Fictitious", null, 0L, null)).contactedOn());
        LocalDate date = LocalDate.of(2026, 11, 5);
        assertEquals(date, service.update(1L,
                new ContactDtos.Input("reference", "Fictitious", null, 0L, date)).contactedOn());
        assertThrows(ApiException.class, () -> service.update(1L,
                new ContactDtos.Input("reference", "Fictitious", null, 0L, null)));
        assertEquals(date, contact.contactedOn);
    }
}
