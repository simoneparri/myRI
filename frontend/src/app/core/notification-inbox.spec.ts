import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { Api, Page, Row } from './api';
import { Auth } from './auth';
import { NotificationInbox } from './notification-inbox';
import { Pwa } from './pwa';

describe('NotificationInbox', () => {
  const empty: Page<Row> = { items: [], page: 0, size: 5, totalElements: 0, totalPages: 0 };
  const user = signal<ReturnType<Auth['user']>>(null);
  let get: ReturnType<typeof vi.fn>;
  let events: Subject<NavigationEnd>;
  let inbox: NotificationInbox;
  let showUnreadNotification: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    user.set(null);
    get = vi.fn().mockResolvedValue(empty);
    showUnreadNotification = vi.fn().mockResolvedValue(undefined);
    events = new Subject<NavigationEnd>();
    TestBed.configureTestingModule({
      providers: [
        { provide: Api, useValue: { get } },
        { provide: Auth, useValue: { user } },
        { provide: Router, useValue: { events } },
        { provide: Pwa, useValue: { showUnreadNotification } },
      ],
    });
    inbox = TestBed.inject(NotificationInbox);
    TestBed.tick();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  async function login() {
    user.set({ id: '1', username: 'fictitious' });
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  }
  it('loads authenticated unread totals on login, navigation and periodic refresh; stops on logout', async () => {
    expect(get).not.toHaveBeenCalled();
    get.mockResolvedValue({ ...empty, totalElements: 8, items: [{ id: '2', kind: 'task_due' }] });
    await login();
    expect(get).toHaveBeenLastCalledWith('notifications', {
      unreadOnly: true,
      includeArchived: false,
      page: 0,
      size: 5,
    });
    expect(inbox.count()).toBe(8);
    events.next(new NavigationEnd(1, '/people', '/people'));
    await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(get).toHaveBeenCalledTimes(3);
    user.set(null);
    TestBed.tick();
    expect(inbox.count()).toBeNull();
    expect(inbox.items()).toEqual([]);
    await vi.advanceTimersByTimeAsync(60_000);
    events.next(new NavigationEnd(2, '/login', '/login'));
    expect(get).toHaveBeenCalledTimes(3);
  });
  it('surfaces failures instead of presenting a false zero and supports retry', async () => {
    get.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    await login();
    expect(inbox.error()).toBeTruthy();
    expect(inbox.count()).toBeNull();
    expect(inbox.loading()).toBe(false);
    get.mockResolvedValue(empty);
    await inbox.refresh();
    expect(inbox.error()).toBe('');
    expect(inbox.count()).toBe(0);
  });
  it('shows a browser notification only when the unread total increases after the initial load', async () => {
    get.mockResolvedValueOnce({
      ...empty,
      totalElements: 2,
      items: [{ id: '1', kind: 'task_due' }],
    });
    await login();
    expect(showUnreadNotification).not.toHaveBeenCalled();

    get.mockResolvedValueOnce({
      ...empty,
      totalElements: 3,
      items: [{ id: '2', kind: 'career_talk_due' }],
    });
    await inbox.refresh();
    expect(showUnreadNotification).toHaveBeenCalledOnce();
  });
  it('ignores stale requests after a newer refresh or logout', async () => {
    await login();
    let resolve!: (value: Page<Row>) => void;
    get.mockImplementationOnce(
      () =>
        new Promise<Page<Row>>((done) => {
          resolve = done;
        }),
    );
    const old = inbox.refresh();
    get.mockResolvedValue({ ...empty, totalElements: 4 });
    await inbox.refresh();
    resolve({ ...empty, totalElements: 20 });
    await old;
    expect(inbox.count()).toBe(4);
    get.mockImplementationOnce(
      () =>
        new Promise<Page<Row>>((done) => {
          resolve = done;
        }),
    );
    const pending = inbox.refresh();
    user.set(null);
    TestBed.tick();
    resolve({ ...empty, totalElements: 50 });
    await pending;
    expect(inbox.count()).toBeNull();
    expect(inbox.items()).toEqual([]);
  });
});
