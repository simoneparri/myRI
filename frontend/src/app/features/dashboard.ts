import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Api, Page, errorMessage } from '../core/api';
import { DisplayPipe } from '../shared/format';
import { italianPaginator } from '../shared/paginator';

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
  template: `
    <h1>Dashboard</h1>
    <button mat-stroked-button (click)="load()" [disabled]="loading()">Aggiorna dashboard</button>
    @if (error()) {
      <p role="alert" class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p role="status">Caricamento dashboard...</p>
    }
    @if (summary(); as summary) {
      <p>Situazione al {{ summary.asOf | display: 'instant' }} · Fuso {{ summary.timezone }}.</p>
      <div class="dashboard-grid">
        <mat-card
          ><mat-card-content
            ><h2>Task oggi: {{ summary.todayTasks }}</h2>
            <a mat-button routerLink="/tasks" [queryParams]="{ view: 'today' }"
              >Vedi oggi</a
            ></mat-card-content
          ></mat-card
        >
        <mat-card
          ><mat-card-content
            ><h2>Scaduti: {{ summary.overdueTasks }}</h2>
            <a mat-button routerLink="/tasks" [queryParams]="{ view: 'overdue' }"
              >Vedi scaduti</a
            ></mat-card-content
          ></mat-card
        >
        <mat-card
          ><mat-card-content
            ><h2>Prossimi 7 giorni: {{ summary.nextSevenTasks }}</h2>
            <a mat-button routerLink="/tasks" [queryParams]="{ view: 'next7' }"
              >Vedi prossimi 7 giorni</a
            ></mat-card-content
          ></mat-card
        >
        <mat-card
          ><mat-card-content
            ><h2>Aumenti aperti: {{ summary.openRaiseRequests }}</h2>
            <p>Bozze, inviate e rimandate non archiviate.</p>
            <a mat-button routerLink="/raise-requests">Vedi aumenti</a></mat-card-content
          ></mat-card
        >
        <mat-card
          ><mat-card-content
            ><h2>Notifiche non lette: {{ summary.unreadNotifications }}</h2>
            <a mat-button routerLink="/notifications">Vedi notifiche</a></mat-card-content
          ></mat-card
        >
      </div>
      <h2>Persone senza career talk recente: {{ summary.peopleWithoutRecentTalk }}</h2>
      <p>
        Soglia: oltre {{ summary.careerMonths }} mesi, solo persone attive non archiviate. Gli
        incontri futuri non sostituiscono un incontro svolto.
      </p>
      @if (careers().items.length === 0 && !loading() && !error()) {
        <p>Nessuna persona oltre soglia.</p>
      }
      <div class="table-scroll">
        <table>
          <caption class="sr-only">
            Career talk da pianificare
          </caption>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Ultimo incontro o assunzione</th>
              <th>Soglia superata dopo</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            @for (person of careers().items; track person.personId) {
              <tr>
                <td>{{ person.firstName }} {{ person.lastName }}</td>
                <td>{{ person.referenceOn | display: 'date' }}</td>
                <td>{{ person.dueAfter | display: 'date' }}</td>
                <td>
                  <a mat-button [routerLink]="['/people', person.personId]">Scheda persona</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <mat-paginator
        [length]="careers().totalElements"
        [pageIndex]="pageIndex"
        [pageSize]="20"
        (page)="paginate($event)"
        aria-label="Paginazione career talk da pianificare"
      ></mat-paginator>
    }
  `,
})
export class Dashboard {
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
