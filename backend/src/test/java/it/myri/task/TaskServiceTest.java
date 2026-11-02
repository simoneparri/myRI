package it.myri.task;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import it.myri.careertalk.*;
import it.myri.common.ApiException;
import it.myri.person.PersonService;
import it.myri.raiserequest.RaiseService;
import java.time.*;
import org.junit.jupiter.api.Test;

class TaskServiceTest {
    private final TaskRepository tasks = mock(TaskRepository.class);
    private final PersonService people = mock(PersonService.class);
    private final CareerTalkService talks = mock(CareerTalkService.class);
    private final RaiseService raises = mock(RaiseService.class);
    private final TaskService service = new TaskService(tasks, people, talks, raises,
            Clock.fixed(Instant.parse("2026-01-01T10:00:00Z"), ZoneOffset.UTC), ZoneId.of("Europe/Rome"));

    @Test
    void rejectsCrossPersonLinksBeforePersistence() {
        CareerTalk talk = new CareerTalk();
        talk.personId = 2L;
        when(talks.get(3L)).thenReturn(talk);
        assertThrows(ApiException.class, () -> service.create(new TaskDtos.Input(
                "Fictitious", null, null, "low", "todo", 1L, 3L, null, null, null, null)));
        verify(tasks, never()).saveAndFlush(any());
    }

    @Test
    void rejectsPartialRecurrenceBeforePersistence() {
        assertThrows(ApiException.class, () -> service.create(new TaskDtos.Input(
                "Fictitious", null, null, "low", "todo", null, null, null, "daily", null, null)));
        verify(tasks, never()).saveAndFlush(any());
    }
}
