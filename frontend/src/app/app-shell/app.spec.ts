import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { Auth } from '../core/auth';
import { NotificationInbox } from '../core/notification-inbox';
import { Pwa } from '../core/pwa';

describe('App', () => {
  it('shows navigation only for an authenticated user', async () => {
    const user = signal<{ id: string; username: string } | null>(null);
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { user } },
        {
          provide: Pwa,
          useValue: {
            notificationError: signal(''),
            notificationPermission: signal('unsupported'),
            browserNotificationsSupported: false,
            requestBrowserNotifications: vi.fn(),
          },
        },
        {
          provide: NotificationInbox,
          useValue: {
            count: signal(3),
            items: signal([]),
            error: signal(''),
            loading: signal(false),
            refresh: vi.fn(),
          },
        },
      ],
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('nav')).toBeNull();
    user.set({ id: '1', username: 'test-owner' });
    await fixture.whenStable();
    expect(element.querySelector('nav')?.textContent).toContain('Persone');
    expect(element.textContent).toContain('Esci');
    expect(element.textContent).toContain('Versione 0.0.0');
    expect(element.querySelector('footer a')?.getAttribute('href')).toBe(
      'https://simoneparri.github.io/',
    );
  });
});
