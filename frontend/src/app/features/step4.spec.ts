import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Api } from '../core/api';
import { TIMEZONE } from '../shared/format';
import { Dashboard } from './dashboard/dashboard';
import { Notifications } from './notifications/notifications';
import { SalaryTrend } from './salary-trend/salary-trend';

describe('Step 4 views', () => {
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  it('renders dashboard totals and calendar links and surfaces failures', async () => {
    const get = vi
      .fn()
      .mockImplementation(async (path: string) =>
        path === 'dashboard'
          ? {
              asOf: '2026-11-03T11:00:00Z',
              timezone: 'Europe/Rome',
              careerMonths: 3,
              todayTasks: 2,
              overdueTasks: 1,
              nextSevenTasks: 4,
              peopleWithoutRecentTalk: 0,
              openRaiseRequests: 3,
              unreadNotifications: 5,
            }
          : empty,
      );
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([]), { provide: Api, useValue: { get } }],
    });
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Task oggi: 2');
    expect(element.querySelector('a[href="/tasks?view=next7"]')).not.toBeNull();
    get.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    await fixture.componentInstance.load();
    await fixture.whenStable();
    expect(element.querySelector('[role=alert]')).not.toBeNull();
    expect(element.textContent).not.toContain('Task oggi: 2');
  });
  it('sends notification filters, versions and preserves conflict feedback', async () => {
    const item = {
      id: '9007199254740993',
      version: '4',
      kind: 'task_due',
      taskId: '2',
      triggeredAt: '2026-11-03T11:00:00Z',
    };
    const get = vi.fn().mockResolvedValue({ ...empty, items: [item], totalElements: 1 });
    const post = vi.fn().mockResolvedValue(item);
    TestBed.configureTestingModule({
      imports: [Notifications],
      providers: [provideRouter([]), { provide: Api, useValue: { get, post } }],
    });
    const fixture = TestBed.createComponent(Notifications);
    await fixture.whenStable();
    fixture.componentInstance.unread = true;
    fixture.componentInstance.kind = 'task_due';
    fixture.componentInstance.search();
    await fixture.whenStable();
    expect(get).toHaveBeenLastCalledWith('notifications', {
      page: 0,
      size: 20,
      unreadOnly: true,
      includeArchived: false,
      kind: 'task_due',
    });
    await fixture.componentInstance.mark(item, 'read');
    expect(post).toHaveBeenLastCalledWith(`notifications/${item.id}/read`, { version: '4' });
    post.mockRejectedValue(new HttpErrorResponse({ status: 409 }));
    await fixture.componentInstance.mark(item, 'archive');
    expect(fixture.componentInstance.error()).toContain('Conflitto');
  });
  it('uses the configured calendar for future salary badges without rounding money', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T23:30:00Z'));
    try {
      const get = vi
        .fn()
        .mockResolvedValue({
          ...empty,
          items: [
            {
              id: '1',
              amount: '9999999999.99',
              currency: 'EUR',
              effectiveOn: '2026-11-04',
              reason: 'Fittizia',
            },
          ],
        });
      TestBed.configureTestingModule({
        imports: [SalaryTrend],
        providers: [
          { provide: Api, useValue: { get } },
          { provide: TIMEZONE, useValue: 'Europe/Rome' },
        ],
      });
      const fixture = TestBed.createComponent(SalaryTrend);
      fixture.componentRef.setInput('personId', '9007199254740993');
      fixture.detectChanges();
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();
      expect(fixture.componentInstance.future({ id: '1', effectiveOn: '2026-11-04' })).toBe(false);
      expect(fixture.componentInstance.future({ id: '2', effectiveOn: '2026-11-05' })).toBe(true);
      expect(get).toHaveBeenCalledWith('people/9007199254740993/salary-trend', {
        page: 0,
        size: 20,
      });
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('9.999.999.999,99');
    } finally {
      vi.useRealTimers();
    }
  });
});
