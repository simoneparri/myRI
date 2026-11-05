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
import { Api, Page, Row, errorMessage } from '../../core/api';
import { Confirm } from '../../shared/confirm/confirm';
import { Detail } from '../../shared/detail/detail';
import { Editor, EditorData } from '../../shared/editor/editor';
import { DisplayPipe, personLabel } from '../../shared/format';
import { Resource, canEdit, definitions, newLabel } from '../../shared/schema';
import { italianPaginator } from '../../shared/paginator';
import { ButtonIcon } from '../../shared/button-icon/button-icon';
import { DateInput, dateInputDisplay, parseDateInput } from '../../shared/date-input/date-input';
import { Toast } from '../../shared/toast';
import { PercentagePipe } from '../../shared/percentage';

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
    PercentagePipe,
    ButtonIcon,
    DateInput,
  ],
  templateUrl: './resource-page.html',
  styleUrl: './resource-page.scss',
})
export class ResourcePage {
  readonly resource = input.required<Resource>();
  readonly personId = input<string>();
  readonly view = input<string>();
  private readonly api = inject(Api);
  private readonly dialogs = inject(MatDialog);
  private readonly toast = inject(Toast);
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
  projectPeriod = '';
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
          this.projectPeriod =
          this.category =
            '';
        this.includeArchived = false;
        this.applied = {};
        void this.reload();
      });
    });
  }
  private path(): string {
    return ['contacts', 'salaries', 'projects'].includes(this.resource())
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
    if (this.resource() === 'projects' && this.projectPeriod)
      this.applied['period'] = this.projectPeriod;
    if (this.category.trim())
      this.applied[this.resource() === 'contacts' ? 'type' : 'currency'] = this.category.trim();
    if (this.personFilter) this.applied['personId'] = this.personFilter;
    try {
      for (const value of [this.from, this.to]) {
        if (value) {
          if (!parseDateInput(dateInputDisplay(value), this.resource() !== 'salaries'))
            throw new Error('Invalid date filter');
        }
      }
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
      if (this.resource() === 'contacts') Object.assign(query, { sort: 'contactedOn,desc' });
      if (this.appliedView) Object.assign(query, { view: this.appliedView });
      if (this.personId() && !['contacts', 'salaries', 'projects'].includes(this.resource())) {
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
      this.toast.success('Salvataggio completato.');
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
      this.toast.success('Esito registrato.');
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
    try {
      const path = `${this.resource()}/${row.id}/${command}`;
      await this.api.post(path, { version: row.version ?? null });
      this.toast.success('Operazione completata.');
      await this.reload();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
