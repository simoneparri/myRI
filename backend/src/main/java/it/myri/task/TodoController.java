package it.myri.task;

import it.myri.common.PageResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/todos")
public class TodoController {
    private final TodoService service;
    public TodoController(TodoService service) { this.service = service; }
    @GetMapping
    public PageResponse<TaskDtos.View> list(@RequestParam(defaultValue = "today") String view,
            @RequestParam(required = false) Long personId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(view, personId, page, size);
    }
}
