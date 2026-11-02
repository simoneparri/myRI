package it.myri.person;

import it.myri.common.PageResponse;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TimelineService {
    private final PersonService people;
    private final TimelineRepository timeline;
    public TimelineService(PersonService people, TimelineRepository timeline) {
        this.people = people;
        this.timeline = timeline;
    }

    public PageResponse<TimelineRepository.Event> list(Long id, Set<String> kinds,
            boolean includeArchived, int page, int size) {
        people.get(id);
        return timeline.list(id, kinds, includeArchived, page, size);
    }
}
