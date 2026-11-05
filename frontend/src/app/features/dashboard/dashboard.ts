import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Api, Page, errorMessage } from '../../core/api';
import { DisplayPipe } from '../../shared/format';
import { italianPaginator } from '../../shared/paginator';

interface CareerDue {
  personId: string;
  firstName: string;
  lastName: string;
  referenceOn: string;
  dueAfter: string;
  lastTalkId: string | null;
}

interface Summary {
  asOf: string;
  timezone: string;
  careerMonths: number;
  todayTasks: number;
  overdueTasks: number;
  nextSevenTasks: number;
  peopleWithoutRecentTalk: number;
  openRaiseRequests: number;
  unreadNotifications: number;
}

@Component({
  imports: [RouterLink, MatButtonModule, MatCardModule, MatPaginatorModule, DisplayPipe],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  readonly careerColumns = [
    { key: 'person', label: 'Persona' },
    { key: 'referenceOn', label: 'Ultimo incontro o assunzione' },
    { key: 'dueAfter', label: 'Soglia superata dopo' },
    { key: 'actions', label: 'Azioni' },
  ] as const;
  private readonly api = inject(Api);
  readonly summary = signal<Summary | null>(null);
  readonly careers = signal<Page<CareerDue>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly error = signal('');
  readonly loading = signal(false);
  pageIndex = 0;
  private generation = 0;
  constructor() {
    void this.load();
  }
  paginate(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    void this.load();
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    this.error.set('');
    this.loading.set(true);
    try {
      const [summary, careers] = await Promise.all([
        this.api.get<Summary>('dashboard'),
        this.api.get<Page<CareerDue>>('dashboard/career-due', { page: this.pageIndex, size: 20 }),
      ]);
      if (generation === this.generation) {
        this.summary.set(summary);
        this.careers.set(careers);
      }
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(errorMessage(error));
        this.summary.set(null);
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
