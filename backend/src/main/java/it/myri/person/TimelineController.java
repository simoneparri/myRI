package it.myri.person;

import it.myri.common.PageResponse;
import java.util.Set;
import org.springframework.web.bind.annotation.*;

@RestController
public class TimelineController {
    private final TimelineService timeline;
    public TimelineController(TimelineService timeline) { this.timeline = timeline; }

    @GetMapping("/api/v1/people/{id}/timeline")
    public PageResponse<TimelineRepository.Event> list(@PathVariable Long id,
            @RequestParam(required = false) Set<String> kinds,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return timeline.list(id, kinds, includeArchived, page, size);
    }
}
