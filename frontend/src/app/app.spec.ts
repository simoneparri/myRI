import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { Auth } from './core/auth';

describe('App', () => {
  it('shows navigation only for an authenticated user', async () => {
    const user = signal<{ id: string; username: string } | null>(null);
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: Auth, useValue: { user } }],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('nav')).toBeNull();
    user.set({ id: '1', username: 'test-owner' });
    await fixture.whenStable();
    expect(element.querySelector('nav')?.textContent).toContain('Persone');
    expect(element.textContent).toContain('Esci');
  });
});
