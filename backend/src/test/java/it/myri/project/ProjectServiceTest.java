package it.myri.project;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import it.myri.common.ApiException;
import it.myri.person.PersonService;
import java.time.*;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ProjectServiceTest {
    private final ProjectRepository repository = mock(ProjectRepository.class);
    private final PersonService people = mock(PersonService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-04T23:30:00Z"), ZoneOffset.UTC);
    private final ProjectService service = new ProjectService(repository, people, clock, ZoneId.of("Europe/Rome"));

    @Test
    void statusUsesApplicationDateInclusiveBoundsAndNullableDates() {
        Project project = new Project();
        project.startsOn = LocalDate.of(2026, 11, 5);
        project.endsOn = project.startsOn;
        assertEquals("current", service.view(project).status());
        project.endsOn = LocalDate.of(2026, 11, 4);
        assertEquals("past", service.view(project).status());
        project.endsOn = null;
        project.startsOn = LocalDate.of(2026, 11, 6);
        assertEquals("upcoming", service.view(project).status());
        project.startsOn = null;
        assertEquals("current", service.view(project).status());
        project.archivedAt = clock.instant();
        assertEquals("archived", service.view(project).status());
    }

    @Test
    void creationValidatesDateOrderBeforeSaving() {
        assertThrows(ApiException.class, () -> service.create(1L,
                new ProjectDtos.Input("Cliente fittizio", LocalDate.of(2026, 11, 6),
                        LocalDate.of(2026, 11, 5), null, "hybrid", null, null)));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void updatesRejectObsoleteVersionsAndArchivedProjects() {
        Project project = new Project();
        project.id = 1L;
        project.personId = 2L;
        project.version = 3L;
        when(repository.findById(1L)).thenReturn(Optional.of(project));
        assertThrows(ApiException.class, () -> service.update(1L,
                new ProjectDtos.Input("Cliente fittizio", null, null, null, "remote", null, 2L)));
        project.archivedAt = clock.instant();
        assertThrows(ApiException.class, () -> service.update(1L,
                new ProjectDtos.Input("Cliente fittizio", null, null, null, "remote", null, 3L)));
        verify(repository, never()).saveAndFlush(any());
    }
}
