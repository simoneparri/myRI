package it.myri.dashboard;

import it.myri.common.PageResponse;
import it.myri.reminder.CareerDueRepository;
import it.myri.salary.SalaryDtos;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service = service; }
    @GetMapping("/dashboard")
    public DashboardService.Summary summary() { return service.summary(); }
    @GetMapping("/dashboard/career-due")
    public PageResponse<CareerDueRepository.View> careerDue(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) { return service.careerDue(page, size); }
    @GetMapping("/people/{id}/salary-trend")
    public PageResponse<SalaryDtos.View> trend(@PathVariable Long id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) { return service.trend(id, page, size); }
}
