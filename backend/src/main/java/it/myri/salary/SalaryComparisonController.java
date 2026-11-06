package it.myri.salary;

import it.myri.common.PageResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/salary-comparison")
public class SalaryComparisonController {
    private final SalaryComparisonService service;
    public SalaryComparisonController(SalaryComparisonService service) { this.service = service; }

    @GetMapping
    public PageResponse<SalaryComparisonDtos.View> list(
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "lastName,asc") String sort) {
        return service.list(includeArchived, page, size, sort);
    }
}
