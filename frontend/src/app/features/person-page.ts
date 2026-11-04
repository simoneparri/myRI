import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Api, Page, Row, errorMessage } from '../core/api';
import { DisplayPipe, TIMEZONE, personLabel } from '../shared/format';
import { ResourcePage } from './resource-page';
import { italianPaginator } from '../shared/paginator';
import { SalaryTrend } from './salary-trend';
import { ButtonIcon } from '../shared/button-icon';
import { Editor, EditorData } from '../shared/editor';
import { canEdit, definitions } from '../shared/schema';

@Component({
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatTabsModule,
    MatPaginatorModule,
    MatSelectModule,
    MatCheckboxModule,
    ResourcePage,
    DisplayPipe,
    SalaryTrend,
    ButtonIcon,
  ],
  template: `
    <a mat-button routerLink="/people"> <svg appButtonIcon="back"></svg>Torna alle persone </a>
    @if (error()) {
      <p role="alert" class="error">{{ error() }}</p>
      <button mat-button (click)="load()"><svg appButtonIcon="refresh"></svg>Riprova</button>
    }
    @if (person(); as person) {
      <div class="section-heading">
        <h1>{{ name(person) }}</h1>
        @if (editable('people', person)) {
          <button mat-stroked-button (click)="edit()" [disabled]="editing()">
            <svg appButtonIcon="edit"></svg>Modifica
          </button>
        }
      </div>
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
      <dl class="person-details" aria-label="Informazioni persona">
        @for (field of fields; track field.key) {
          <div [class.full-width]="field.type === 'textarea'">
            <dt>{{ field.label }}</dt>
            <dd>{{ person[field.key] | display: field.type }}</dd>
          </div>
        }
        <div>
          <dt>Anzianita aziendale</dt>
          <dd>{{ person['seniority'] | display }}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>{{ person.id }}</dd>
        </div>
        @if (person['archivedAt']) {
          <div>
            <dt>Archiviato</dt>
            <dd>{{ person['archivedAt'] | display: 'instant' }}</dd>
          </div>
        }
      </dl>
      <p>Orari visualizzati in {{ timezone }}.</p>
      <p>
        Export completo della persona, incluse voci archiviate (massimo 1000 record). Il file
        contiene dati personali: conservalo in modo protetto.
      </p>
      <button mat-stroked-button (click)="download('json')" [disabled]="exporting()">
        <svg appButtonIcon="download"></svg>Esporta JSON
      </button>
      <button mat-stroked-button (click)="download('csv')" [disabled]="exporting()">
        <svg appButtonIcon="download"></svg>Esporta CSV
      </button>
      @if (exportError()) {
        <p role="alert" class="error">{{ exportError() }}</p>
      }
      @if (exporting()) {
        <p role="status">Preparazione export...</p>
      }
      <mat-tab-group (selectedIndexChange)="$event === 0 && loadTimeline()">
        <mat-tab label="Timeline"
          ><ng-template matTabContent>
            <form class="filters" (ngSubmit)="filterTimeline()">
              <mat-form-field appearance="outline"
                ><mat-label>Tipo evento</mat-label>
                <mat-select name="kind" [(ngModel)]="kind">
                  <mat-option value="">Tutti</mat-option>
                  @for (value of ['salary', 'raise_request', 'career_talk', 'task']; track value) {
                    <mat-option [value]="value">{{ value | display }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-checkbox name="archived" [(ngModel)]="includeArchived"
                >Includi archiviati</mat-checkbox
              >
              <button mat-stroked-button><svg appButtonIcon="filter"></svg>Applica filtri</button>
            </form>
            @if (timelineError()) {
              <p role="alert" class="error">{{ timelineError() }}</p>
            }
            @if (loading()) {
              <p role="status">Caricamento timeline...</p>
            } @else if (timeline().items.length === 0 && !timelineError()) {
              <p>Nessun evento.</p>
            }
            <ol class="timeline">
              @for (event of timeline().items; track event['kind'] + ':' + event.id) {
                <li>
                  <strong>{{ event['title'] }}</strong>
                  <span>
                    ·
                    {{
                      event['eventDate'] || event['sortAt']
                        | display: (event['eventDate'] ? 'date' : 'instant')
                    }}</span
                  >
                  @if (event['amount']) {
                    <span>
                      · {{ event['amount'] | display: 'decimal' }} {{ event['currency'] }}</span
                    >
                  }
                  @if (event['status']) {
                    <span> · {{ event['status'] | display }}</span>
                  }
                  @if (event['archived']) {
                    <span class="badge">Archiviato</span>
                  }
                  <span class="muted"> · {{ event['kind'] | display }} #{{ event.id }}</span>
                </li>
              }
            </ol>
            <mat-paginator
              [length]="timeline().totalElements"
              [pageIndex]="pageIndex"
              [pageSize]="20"
              (page)="paginate($event)"
              aria-label="Paginazione timeline"
            ></mat-paginator> </ng-template
        ></mat-tab>
        @for (tab of tabs; track tab.resource) {
          <mat-tab [label]="tab.label"
            ><ng-template matTabContent>
              <app-resource-page [resource]="tab.resource" [personId]="id()" /> </ng-template
          ></mat-tab>
        }
        <mat-tab label="Andamento RAL"
          ><ng-template matTabContent> <app-salary-trend [personId]="id()" /> </ng-template
        ></mat-tab>
      </mat-tab-group>
    } @else if (!error()) {
      <p role="status">Caricamento persona...</p>
    }
  `,
  styles: `
    .person-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
      gap: 1rem 2rem;
    }
    .person-details > div {
      min-width: 0;
    }
    .person-details .full-width {
      grid-column: 1 / -1;
    }
    .person-details dt,
    .person-details dd {
      margin-top: 0;
      margin-bottom: 0.25rem;
    }
  `,
})
export class PersonPage {
  readonly id = input.required<string>();
  private readonly api = inject(Api);
  private readonly dialogs = inject(MatDialog);
  readonly fields = definitions.people.fields;
  readonly editable = canEdit;
  readonly editing = signal(false);
  readonly message = signal('');
  readonly timezone = inject(TIMEZONE);
  readonly person = signal<Row | null>(null);
  readonly name = personLabel;
  readonly error = signal('');
  readonly timelineError = signal('');
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly exportError = signal('');
  readonly timeline = signal<Page<Row>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly tabs = [
    { resource: 'contacts' as const, label: 'Contatti' },
    { resource: 'salaries' as const, label: 'RAL' },
    { resource: 'raise-requests' as const, label: 'Aumenti' },
    { resource: 'career-talks' as const, label: 'Career talk' },
    { resource: 'tasks' as const, label: 'Task' },
  ];
  kind = '';
  includeArchived = false;
  pageIndex = 0;
  private generation = 0;
  private personGeneration = 0;
  private appliedKind = '';
  private appliedArchived = false;
  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.pageIndex = 0;
        this.kind = this.appliedKind = '';
        this.includeArchived = this.appliedArchived = false;
        this.message.set('');
        void this.load();
      });
    });
  }
  async edit(): Promise<void> {
    const row = this.person();
    if (!row || !canEdit('people', row) || this.editing()) return;
    const generation = this.personGeneration;
    this.editing.set(true);
    try {
      const changed = await firstValueFrom(
        this.dialogs
          .open(Editor, {
            data: { resource: 'people', path: 'people', row } satisfies EditorData,
            width: '720px',
            maxWidth: '95vw',
          })
          .afterClosed(),
      );
      if (changed && generation === this.personGeneration) {
        this.message.set('Dati salvati.');
        await this.load();
      }
    } finally {
      this.editing.set(false);
    }
  }
  async download(format: 'json' | 'csv'): Promise<void> {
    this.exporting.set(true);
    this.exportError.set('');
    try {
      const blob = await this.api.download(`people/${this.id()}/export?format=${format}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `person-export.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.exportError.set(errorMessage(error));
    } finally {
      this.exporting.set(false);
    }
  }
  async load(): Promise<void> {
    const generation = ++this.personGeneration;
    ++this.generation;
    this.person.set(null);
    this.error.set('');
    this.timeline.set({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    try {
      const person = await this.api.get<Row>(`people/${this.id()}`);
      if (generation !== this.personGeneration) return;
      this.person.set(person);
      await this.loadTimeline();
    } catch (error) {
      if (generation === this.personGeneration) this.error.set(errorMessage(error));
    }
  }
  filterTimeline(): void {
    this.pageIndex = 0;
    this.appliedKind = this.kind;
    this.appliedArchived = this.includeArchived;
    void this.loadTimeline();
  }
  paginate(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    void this.loadTimeline();
  }
  async loadTimeline(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.timelineError.set('');
    try {
      const page = await this.api.get<Page<Row>>(`people/${this.id()}/timeline`, {
        page: this.pageIndex,
        size: 20,
        ...(this.appliedKind ? { kinds: this.appliedKind } : {}),
        includeArchived: this.appliedArchived,
      });
      if (generation === this.generation) this.timeline.set(page);
    } catch (error) {
      if (generation === this.generation) {
        this.timelineError.set(errorMessage(error));
        this.timeline.set({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
