import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { Api, Page, Row, errorMessage } from '../core/api';
import { Confirm } from '../shared/confirm';
import { Detail } from '../shared/detail';
import { Editor, EditorData } from '../shared/editor';
import { DisplayPipe, TIMEZONE, personLabel } from '../shared/format';
import { Resource, canEdit, definitions, newLabel } from '../shared/schema';
import { italianPaginator } from '../shared/paginator';
import { ButtonIcon } from '../shared/button-icon';

@Component({
  selector: 'app-resource-page',
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    DisplayPipe,
    ButtonIcon,
  ],
  template: `
    <section>
      <div class="section-heading">
        <h2>{{ definition().title }}</h2>
        <button mat-flat-button (click)="edit()" [disabled]="busy() || loading()">
          <svg appButtonIcon="add"></svg>
          {{ newLabel(resource()) }}
        </button>
      </div>
      <form class="filters" (ngSubmit)="search()">
        @if (resource() === 'tasks') {
          <mat-form-field appearance="outline"
            ><mat-label>Vista task</mat-label>
            <mat-select name="view" [(ngModel)]="todoView" (selectionChange)="search()">
              <mat-option value="">Gestione completa</mat-option>
              <mat-option value="all">Tutti aperti</mat-option>
              <mat-option value="today">Oggi</mat-option>
              <mat-option value="overdue">Scaduti</mat-option>
              <mat-option value="next7">Prossimi 7 giorni</mat-option>
            </mat-select>
          </mat-form-field>
        }
        @if (!todoView) {
          <mat-form-field appearance="outline"
            ><mat-label>Cerca</mat-label>
            <input matInput name="q" [(ngModel)]="q" maxlength="200" />
          </mat-form-field>
          @if (definition().statuses) {
            <mat-form-field appearance="outline"
              ><mat-label>Stato</mat-label>
              <mat-select name="status" [(ngModel)]="status">
                <mat-option value="">Tutti</mat-option>
                @for (value of definition().statuses; track value) {
                  <mat-option [value]="value">{{ value | display }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        }
        @if (!personId() && resource() !== 'people') {
          <mat-form-field appearance="outline"
            ><mat-label>Persona</mat-label>
            <mat-select name="person" [(ngModel)]="personFilter">
              <mat-option value="">Tutte</mat-option>
              @for (person of people(); track person.id) {
                <mat-option [value]="person.id">{{ name(person) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @if (resource() === 'tasks' && !todoView) {
          <mat-form-field appearance="outline"
            ><mat-label>Priorita</mat-label>
            <mat-select name="priority" [(ngModel)]="priority"
              ><mat-option value="">Tutte</mat-option>
              @for (value of ['low', 'medium', 'high']; track value) {
                <mat-option [value]="value">{{ value | display }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @if (resource() === 'people') {
          <mat-form-field appearance="outline"
            ><mat-label>Manager interno</mat-label>
            <mat-select name="manager" [(ngModel)]="manager">
              <mat-option value="">Tutti</mat-option>
              @for (person of people(); track person.id) {
                <mat-option [value]="person.id">{{ name(person) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @if (resource() === 'contacts' || resource() === 'salaries') {
          <mat-form-field appearance="outline"
            ><mat-label>{{ resource() === 'contacts' ? 'Tipo contatto' : 'Valuta ISO' }}</mat-label>
            <input
              matInput
              name="category"
              [(ngModel)]="category"
              [attr.maxlength]="resource() === 'contacts' ? 50 : 3"
            />
          </mat-form-field>
        }
        @if (
          (resource() === 'tasks' && !todoView) ||
          resource() === 'career-talks' ||
          resource() === 'salaries'
        ) {
          <mat-form-field appearance="outline"
            ><mat-label>Dal {{ resource() === 'salaries' ? '' : '(UTC)' }}</mat-label>
            <input
              matInput
              name="from"
              [(ngModel)]="from"
              [type]="resource() === 'salaries' ? 'date' : 'datetime-local'"
            />
          </mat-form-field>
          <mat-form-field appearance="outline"
            ><mat-label>Al (escluso) {{ resource() === 'salaries' ? '' : '(UTC)' }}</mat-label>
            <input
              matInput
              name="to"
              [(ngModel)]="to"
              [type]="resource() === 'salaries' ? 'date' : 'datetime-local'"
            />
          </mat-form-field>
        }
        @if (resource() !== 'salaries' && !todoView) {
          <mat-checkbox name="archived" [(ngModel)]="includeArchived"
            >Includi archiviati</mat-checkbox
          >
        }
        <button mat-stroked-button type="submit" [disabled]="loading()">
          <svg appButtonIcon="filter"></svg>Applica filtri
        </button>
        <button mat-button type="button" (click)="reload()" [disabled]="loading()">
          <svg appButtonIcon="refresh"></svg>Ricarica
        </button>
      </form>
      <p class="muted">Orari visualizzati in {{ timezone }}. Inserimento e filtri orari in UTC.</p>
      @if (todoView) {
        <p>
          Solo task aperti non archiviati. Oggi e scaduti possono sovrapporsi; i prossimi 7 giorni
          iniziano domani. Task senza scadenza solo in Tutti aperti.
        </p>
      }
      @if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
      }
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
      @if (loading()) {
        <p role="status">Caricamento...</p>
      } @else if (page().items.length === 0 && !error()) {
        <p>Nessun risultato.</p>
      }
      @if (page().items.length > 0) {
        <div class="table-scroll" [attr.aria-busy]="loading()">
          <table>
            <caption class="sr-only">
              {{
                definition().title
              }}
            </caption>
            <thead>
              <tr>
                @for (column of definition().columns; track column.key) {
                  <th scope="col">{{ column.label }}</th>
                }
                <th scope="col">Azioni</th>
              </tr>
            </thead>
            <tbody>
              @for (row of page().items; track row.id) {
                <tr [class.archived]="row['archivedAt']">
                  @for (column of definition().columns; track column.key) {
                    <td>
                      {{
                        column.key === 'personId'
                          ? personName(row[column.key])
                          : (row[column.key] | display: column.type)
                      }}
                      @if ($first && row['archivedAt']) {
                        <span class="badge">Archiviato</span>
                      }
                    </td>
                  }
                  <td class="actions">
                    @if (resource() === 'people') {
                      <a mat-button [routerLink]="['/people', row.id]">
                        <svg appButtonIcon="person"></svg>Scheda
                      </a>
                    } @else {
                      <button mat-button (click)="details(row)">
                        <svg appButtonIcon="detail"></svg>Dettagli
                      </button>
                    }
                    @if (resource() !== 'people' && editable(resource(), row)) {
                      <button mat-button (click)="edit(row)" [disabled]="busy() || loading()">
                        <svg appButtonIcon="edit"></svg>Modifica
                      </button>
                    }
                    @if (!row['archivedAt'] && resource() !== 'salaries') {
                      @if (resource() === 'raise-requests') {
                        @if (row['status'] === 'draft') {
                          <button
                            mat-button
                            (click)="command(row, 'submit')"
                            [disabled]="busy() || loading()"
                          >
                            <svg appButtonIcon="send"></svg>Invia
                          </button>
                        }
                        @if (row['status'] === 'postponed') {
                          <button
                            mat-button
                            (click)="command(row, 'reopen')"
                            [disabled]="busy() || loading()"
                          >
                            <svg appButtonIcon="refresh"></svg>Riapri
                          </button>
                        }
                        @if (row['status'] === 'submitted') {
                          <button
                            mat-button
                            (click)="decision(row, 'approve')"
                            [disabled]="busy() || loading()"
                          >
                            <svg appButtonIcon="check"></svg>Approva
                          </button>
                          <button
                            mat-button
                            (click)="decision(row, 'reject')"
                            [disabled]="busy() || loading()"
                          >
                            <svg appButtonIcon="close"></svg>Rifiuta
                          </button>
                          <button
                            mat-button
                            (click)="decision(row, 'postpone')"
                            [disabled]="busy() || loading()"
                          >
                            <svg appButtonIcon="clock"></svg>Rimanda
                          </button>
                        }
                      }
                      @if (resource() === 'tasks' && editable(resource(), row)) {
                        <button
                          mat-button
                          (click)="command(row, 'complete')"
                          [disabled]="busy() || loading()"
                        >
                          <svg appButtonIcon="check"></svg>Completa
                        </button>
                        <button
                          mat-button
                          (click)="command(row, 'cancel')"
                          [disabled]="busy() || loading()"
                        >
                          <svg appButtonIcon="close"></svg>Annulla task
                        </button>
                      }
                      <button
                        mat-button
                        (click)="command(row, 'archive')"
                        [disabled]="busy() || loading()"
                      >
                        <svg appButtonIcon="archive"></svg>Archivia
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <mat-paginator
        [length]="page().totalElements"
        [pageIndex]="pageIndex"
        [pageSize]="size"
        [pageSizeOptions]="[10, 20, 50, 100]"
        (page)="paginate($event)"
        aria-label="Paginazione"
      ></mat-paginator>
    </section>
  `,
})
export class ResourcePage {
  readonly resource = input.required<Resource>();
  readonly personId = input<string>();
  readonly view = input<string>();
  private readonly api = inject(Api);
  private readonly dialogs = inject(MatDialog);
  readonly timezone = inject(TIMEZONE);
  readonly definition = signal(definitions.people);
  readonly page = signal<Page<Row>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly people = signal<Row[]>([]);
  readonly error = signal('');
  readonly message = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly editable = canEdit;
  readonly newLabel = newLabel;
  readonly name = personLabel;
  q = '';
  todoView = '';
  private appliedView = '';
  status = '';
  personFilter = '';
  priority = '';
  from = '';
  to = '';
  manager = '';
  category = '';
  includeArchived = false;
  pageIndex = 0;
  size = 20;
  private generation = 0;
  private applied: Record<string, string | boolean> = {};

  constructor() {
    effect(() => {
      const resource = this.resource();
      this.personId();
      const view = this.view();
      untracked(() => {
        this.todoView = this.appliedView =
          resource === 'tasks' &&
          view !== undefined &&
          ['today', 'overdue', 'next7', 'all'].includes(view)
            ? view
            : '';
        this.definition.set(definitions[resource]);
        this.pageIndex = 0;
        this.q =
          this.status =
          this.personFilter =
          this.priority =
          this.from =
          this.to =
          this.manager =
          this.category =
            '';
        this.includeArchived = false;
        this.applied = {};
        void this.reload();
      });
    });
  }
  private path(): string {
    return this.resource() === 'contacts' || this.resource() === 'salaries'
      ? `people/${this.personId()}/${this.resource()}`
      : this.resource();
  }
  personName(value: unknown): string {
    const person = this.people().find((person) => person.id === value);
    return person ? personLabel(person) : value ? `#${value}` : '-';
  }
  async search(): Promise<void> {
    this.pageIndex = 0;
    this.appliedView = this.todoView;
    if (this.appliedView) {
      this.applied = this.personFilter ? { personId: this.personFilter } : {};
      await this.reload();
      return;
    }
    this.applied = { includeArchived: this.includeArchived };
    if (this.q.trim()) this.applied['q'] = this.q.trim();
    if (this.status) this.applied['status'] = this.status;
    if (this.priority) this.applied['priority'] = this.priority;
    if (this.manager) this.applied['managerId'] = this.manager;
    if (this.category.trim())
      this.applied[this.resource() === 'contacts' ? 'type' : 'currency'] = this.category.trim();
    if (this.personFilter) this.applied['personId'] = this.personFilter;
    try {
      if (this.from)
        this.applied['from'] =
          this.resource() === 'salaries' ? this.from : new Date(this.from + 'Z').toISOString();
      if (this.to)
        this.applied['to'] =
          this.resource() === 'salaries' ? this.to : new Date(this.to + 'Z').toISOString();
    } catch {
      this.error.set('Intervallo date non valido.');
      return;
    }
    await this.reload();
  }
  async reload(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const query = { ...this.applied, page: this.pageIndex, size: this.size };
      if (this.appliedView) Object.assign(query, { view: this.appliedView });
      if (this.personId() && !['contacts', 'salaries'].includes(this.resource())) {
        Object.assign(query, { personId: this.personId() });
      }
      const [page, people] = await Promise.all([
        this.api.get<Page<Row>>(this.appliedView ? 'todos' : this.path(), query),
        this.api.choices('people'),
      ]);
      if (generation !== this.generation) return;
      this.page.set(page);
      this.people.set(people);
      if (page.items.length === 0 && this.pageIndex > 0) {
        this.pageIndex--;
        await this.reload();
      }
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(errorMessage(error));
        this.page.set({ items: [], page: 0, size: this.size, totalElements: 0, totalPages: 0 });
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  paginate(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.size = event.pageSize;
    void this.reload();
  }
  details(row: Row): void {
    this.dialogs.open(Detail, {
      data: { row, definition: this.definition() },
      width: '680px',
      maxWidth: '95vw',
    });
  }
  async edit(row?: Row): Promise<void> {
    const data: EditorData = {
      resource: this.resource(),
      path: this.path(),
      row,
      personId: this.personId(),
    };
    const changed = await firstValueFrom(
      this.dialogs.open(Editor, { data, width: '720px', maxWidth: '95vw' }).afterClosed(),
    );
    if (changed) {
      this.message.set('Dati salvati.');
      await this.reload();
    }
  }
  async decision(row: Row, command: 'approve' | 'reject' | 'postpone'): Promise<void> {
    const changed = await firstValueFrom(
      this.dialogs
        .open(Editor, {
          data: { resource: this.resource(), path: this.path(), row, command } satisfies EditorData,
          width: '680px',
          maxWidth: '95vw',
        })
        .afterClosed(),
    );
    if (changed) {
      this.message.set('Esito registrato.');
      await this.reload();
    }
  }
  async command(row: Row, command: string): Promise<void> {
    const messages: Record<string, string> = {
      archive: 'Archiviare la risorsa? Lo storico sara conservato.',
      complete: 'Completare il task? Se ricorrente, verra creata una sola prossima occorrenza.',
      cancel: 'Annullare il task senza generare una nuova occorrenza?',
      submit: 'Inviare la richiesta di aumento?',
      reopen: 'Riaprire in bozza azzerando le note di esito?',
    };
    if (
      !(await firstValueFrom(this.dialogs.open(Confirm, { data: messages[command] }).afterClosed()))
    )
      return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const path = `${this.resource()}/${row.id}/${command}`;
      await this.api.post(path, { version: row.version ?? null });
      this.message.set('Operazione completata.');
      await this.reload();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
