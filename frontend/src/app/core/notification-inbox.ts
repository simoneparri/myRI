import { Injectable, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, merge, timer } from 'rxjs';
import { Api, Page, Row, errorMessage } from './api';
import { Auth } from './auth';
import { Pwa } from './pwa';

export function notificationTitle(item: Row): string {
  if (item['kind'] === 'task_due') {
    return `Task in scadenza: ${item['taskTitle'] ?? '#' + item['taskId']}`;
  }
  const person = item['personName'] ?? (item['personId'] ? `Persona #${item['personId']}` : '');
  return person ? `Career talk da pianificare · ${person}` : 'Career talk da pianificare';
}

@Injectable({ providedIn: 'root' })
export class NotificationInbox {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly pwa = inject(Pwa);
  readonly count = signal<number | null>(null);
  readonly items = signal<Row[]>([]);
  readonly error = signal('');
  readonly loading = signal(false);
  private generation = 0;

  constructor() {
    effect((onCleanup) => {
      const user = this.auth.user();
      this.generation++;
      this.count.set(null);
      this.items.set([]);
      this.error.set('');
      this.loading.set(false);
      if (!user) return;
      const subscription = merge(
        timer(0, 60_000),
        this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
      ).subscribe(() => void this.refresh());
      onCleanup(() => subscription.unsubscribe());
    });
  }

  async refresh(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.api.get<Page<Row>>('notifications', {
        unreadOnly: true,
        includeArchived: false,
        page: 0,
        size: 5,
      });
      if (generation !== this.generation || this.auth.user() !== user) return;
      const previousCount = this.count();
      this.items.set(page.items);
      this.count.set(page.totalElements);
      if (previousCount !== null && page.totalElements > previousCount) {
        void this.pwa.showUnreadNotification();
      }
    } catch (error) {
      if (generation !== this.generation || this.auth.user() !== user) return;
      this.items.set([]);
      this.count.set(null);
      this.error.set(errorMessage(error));
    } finally {
      if (generation === this.generation && this.auth.user() === user) this.loading.set(false);
    }
  }
}
