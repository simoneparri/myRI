import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotificationInbox } from '../../core/notification-inbox';
import { Pwa } from '../../core/pwa';
import { Row } from '../../core/api';
import { NotificationBell } from './notification-bell';

describe('NotificationBell', () => {
  it('opens unread items with a total and full-page link, without marking them read', async () => {
    const inbox = {
      count: signal<number | null>(7),
      items: signal<Row[]>([{ id: '1', kind: 'task_due', taskId: '4' }]),
      loading: signal(false),
      error: signal(''),
      refresh: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: NotificationInbox, useValue: inbox },
        {
          provide: Pwa,
          useValue: {
            browserNotificationsSupported: false,
            notificationPermission: signal('unsupported'),
            notificationError: signal(''),
            requestBrowserNotifications: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(NotificationBell);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Notifiche non lette: 7');
    expect(fixture.nativeElement.textContent).toContain('7');
    button.click();
    await fixture.whenStable();
    expect(inbox.refresh).toHaveBeenCalledOnce();
    const menu = document.querySelector('[role="menu"]')!;
    expect(menu.textContent).toContain('Task in scadenza #4');
    expect(menu.textContent).toContain('Mostrate 1 di 7');
    expect(menu.querySelector('a')?.getAttribute('href')).toBe('/notifications?unread=true');
    inbox.items.set([]);
    inbox.count.set(null);
    inbox.error.set('Errore fittizio');
    await fixture.whenStable();
    expect(button.getAttribute('aria-label')).toBe('Notifiche non disponibili');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Errore fittizio');
    const retry = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.includes('Riprova'),
    )!;
    retry.click();
    expect(inbox.refresh).toHaveBeenCalledTimes(2);
  });
});
