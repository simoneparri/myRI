import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { Auth } from '../core/auth';
import { NotificationInbox } from '../core/notification-inbox';
import { Pwa } from '../core/pwa';

@Component({ selector: 'app-test-page', template: '' })
class TestPage {}

describe('App', () => {
  it('shows navigation only for an authenticated user', async () => {
    const user = signal<{ id: string; username: string } | null>(null);
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'dashboard', component: TestPage },
          { path: 'company-closures', component: TestPage },
        ]),
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
    const nav = element.querySelector('nav')!;
    const labels = Array.from(nav.querySelectorAll(':scope > a, :scope > button')).map((item) =>
      item.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Dashboard',
      'Task',
      'Persone',
      'Confronto RAL',
      'Assenze',
      'Import/Export',
    ]);
    const sections = fixture.componentInstance.navigation;
    expect(
      sections.find((section) => section.label === 'Persone')?.children.map((item) => item.path),
    ).toEqual(['/people', '/raise-requests', '/career-talks']);
    expect(
      sections.find((section) => section.label === 'Assenze')?.children.map((item) => item.path),
    ).toEqual(['/absences', '/company-closures']);
    expect(element.textContent).toContain('Esci');

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    await fixture.whenStable();
    fixture.detectChanges();
    const dashboardLink = nav.querySelector('a[href="/dashboard"]');
    expect(dashboardLink?.classList.contains('selected')).toBe(true);
    expect(dashboardLink?.getAttribute('aria-current')).toBe('page');

    await router.navigateByUrl('/company-closures');
    await fixture.whenStable();
    fixture.detectChanges();
    const absencesButton = Array.from(nav.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Assenze'),
    );
    expect(absencesButton?.classList.contains('selected')).toBe(true);
    expect(absencesButton?.getAttribute('aria-current')).toBe('location');
    absencesButton?.click();
    await fixture.whenStable();
    const activeMenuItem = document.body.querySelector('.mat-mdc-menu-item.selected');
    expect(activeMenuItem?.textContent).toContain('Chiusure Aziendali');
    expect(activeMenuItem?.getAttribute('aria-current')).toBe('page');
    expect(element.textContent).toMatch(/Versione \d+\.\d+\.\d+/);
    expect(element.querySelector('footer a')?.getAttribute('href')).toBe(
      'https://simoneparri.github.io/',
    );
  });
});
