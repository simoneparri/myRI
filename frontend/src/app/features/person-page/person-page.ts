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
import { Api, Page, Row, errorMessage } from '../../core/api';
import { DisplayPipe } from '../../shared/format';
import { ResourcePage } from '../resource-page/resource-page';
import { italianPaginator } from '../../shared/paginator';
import { SalaryTrend } from '../salary-trend/salary-trend';
import { ButtonIcon } from '../../shared/button-icon/button-icon';
import { Editor, EditorData } from '../../shared/editor/editor';
import { canEdit, definitions } from '../../shared/schema';
import { Toast } from '../../shared/toast';
import { frameworkIconClass } from '../../shared/framework-catalog';
import { FrameworkIcons } from '../../shared/framework-icons';

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
  templateUrl: './person-page.html',
  styleUrl: './person-page.scss',
})
export class PersonPage {
  readonly id = input.required<string>();
  private readonly api = inject(Api);
  private readonly dialogs = inject(MatDialog);
  private readonly toast = inject(Toast);
  private readonly frameworkIcons = inject(FrameworkIcons);
  readonly fields = definitions.people.fields.filter(
    (field) => !['status', 'firstName', 'lastName'].includes(field.key),
  );
  readonly editable = canEdit;
  readonly editing = signal(false);
  readonly person = signal<Row | null>(null);
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
    { resource: 'projects' as const, label: 'Progetti' },
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
    this.frameworkIcons.load();
    effect(() => {
      this.id();
      untracked(() => {
        this.pageIndex = 0;
        this.kind = this.appliedKind = '';
        this.includeArchived = this.appliedArchived = false;
        void this.load();
      });
    });
  }
  mypadUrl(person: Row): string | null {
    const id = person['mypadId'];
    return typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id)
      ? `https://mypad.altengroup.com/employees/${encodeURIComponent(id)}`
      : null;
  }
  frameworkList(person: Row): string[] {
    const frameworks = person['frameworks'];
    if (!Array.isArray(frameworks)) return [];
    const values: unknown[] = frameworks;
    return values
      .filter((framework): framework is string => typeof framework === 'string')
      .map((framework) => framework.trim())
      .filter(Boolean);
  }
  readonly frameworkIconClass = frameworkIconClass;
  displayName(person: Row): string {
    const firstName = String(person['firstName'] ?? '');
    const lastName = String(person['lastName'] ?? '').toLocaleUpperCase('it-IT');
    return `${firstName} ${lastName}${person['archivedAt'] ? ' (archiviata)' : ''}`;
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
        this.toast.success('Salvataggio completato.');
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
