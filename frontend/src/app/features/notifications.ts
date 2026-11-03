import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Api, Page, Row, errorMessage } from '../core/api';
import { DisplayPipe } from '../shared/format';
import { italianPaginator } from '../shared/paginator';
import { MatDialog } from '@angular/material/dialog';
import { Detail } from '../shared/detail';
import { definitions } from '../shared/schema';

@Component({
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatSelectModule,
    DisplayPipe,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  template: `
    <h1>Notifiche</h1>
    <p>
      Promemoria storici: completare un task o registrare un incontro non elimina notifiche
      precedenti. I reminder vengono generati periodicamente, non occorre tenere aperta questa
      pagina.
    </p>
    <form class="filters" (ngSubmit)="search()">
      <mat-form-field
        ><mat-label>Tipo notifica</mat-label
        ><mat-select name="kind" [(ngModel)]="kind">
          <mat-option value="">Tutti</mat-option
          ><mat-option value="task_due">Scadenza task</mat-option>
          <mat-option value="career_talk_due">Career talk da pianificare</mat-option>
        </mat-select></mat-form-field
      >
      <mat-checkbox name="unread" [(ngModel)]="unread">Solo non lette</mat-checkbox>
      <mat-checkbox name="archived" [(ngModel)]="archived">Includi archiviati</mat-checkbox>
      <button mat-stroked-button [disabled]="loading() || busy()">Aggiorna notifiche</button>
    </form>
    @if (error()) {
      <p role="alert" class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p role="status">Caricamento notifiche...</p>
    } @else if (data().items.length === 0 && !error()) {
      <p>Nessuna notifica.</p>
    }
    <ul class="timeline">
      @for (item of data().items; track item.id) {
        <li>
          <strong>{{
            item['kind'] === 'task_due'
              ? 'Task in scadenza #' + item['taskId']
              : 'Career talk da pianificare'
          }}</strong>
          <span> · {{ item['triggeredAt'] | display: 'instant' }}</span>
          @if (item['readAt']) {
            <span class="badge">Letta</span>
          }
          @if (item['archivedAt']) {
            <span class="badge">Archiviata</span>
          }
          @if (item['personId']) {
            <a mat-button [routerLink]="['/people', item['personId']]"
              >Scheda persona #{{ item['personId'] }}</a
            >
          }
          @if (item['taskId']) {
            <button mat-button (click)="openTask(item)" [disabled]="busy()">Apri task</button>
          }
          @if (!item['readAt'] && !item['archivedAt']) {
            <button mat-button (click)="mark(item, 'read')" [disabled]="busy() || loading()">
              Segna letta
            </button>
          }
          @if (!item['archivedAt']) {
            <button mat-button (click)="mark(item, 'archive')" [disabled]="busy() || loading()">
              Archivia notifica
            </button>
          }
        </li>
      }
    </ul>
    <mat-paginator
      [length]="data().totalElements"
      [pageIndex]="pageIndex"
      [pageSize]="20"
      (page)="paginate($event)"
      aria-label="Paginazione notifiche"
    ></mat-paginator>
  `,
})
export class Notifications {
  private readonly api = inject(Api);
  private readonly dialogs = inject(MatDialog);
  readonly data = signal<Page<Row>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly error = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);
  kind = '';
  unread = false;
  archived = false;
  pageIndex = 0;
  private query: Record<string, string | boolean> = {};
  private generation = 0;
  constructor() {
    void this.load();
  }
  async openTask(item: Row): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const row = await this.api.get<Row>(`tasks/${item['taskId']}`);
      this.dialogs.open(Detail, {
        data: { row, definition: definitions.tasks },
        width: '680px',
        maxWidth: '95vw',
      });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  search(): void {
    this.pageIndex = 0;
    this.query = {
      unreadOnly: this.unread,
      includeArchived: this.archived,
      ...(this.kind ? { kind: this.kind } : {}),
    };
    void this.load();
  }
  paginate(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    void this.load();
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.get<Page<Row>>('notifications', {
        ...this.query,
        page: this.pageIndex,
        size: 20,
      });
      if (generation !== this.generation) return;
      this.data.set(data);
      if (data.items.length === 0 && this.pageIndex > 0) {
        this.pageIndex--;
        await this.load();
      }
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(errorMessage(error));
        this.data.set({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async mark(item: Row, command: 'read' | 'archive'): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post(`notifications/${item.id}/${command}`, { version: item.version ?? null });
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
