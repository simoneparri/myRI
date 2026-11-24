import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Api, Page, Row, errorMessage } from '../../core/api';
import { calendarDate, TIMEZONE } from '../../shared/format';
import { italianPaginator } from '../../shared/paginator';
import { italianHolidays } from './italian-holidays';

interface Absence {
  id: string;
  personId: string;
  firstName: string;
  lastName: string;
  startsAt: string;
  endsAt: string;
  code: string;
  label: string;
  status: string;
  days: string;
  hours: string;
  importedToTimesheet: string;
}
interface ImportReport {
  imported: number;
  unchanged: number;
  skipped: number;
  replaced: number;
  errors: { row: number; reason: string }[];
}
interface Day {
  date: string;
  number: number;
  inMonth: boolean;
  items: Absence[];
  holiday: string | null;
  closed: boolean;
}

@Component({
  selector: 'app-absences',
  imports: [
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  templateUrl: './absences.html',
  styleUrl: './absences.scss',
})
export class Absences {
  private readonly api = inject(Api);
  private readonly zone = inject(TIMEZONE);
  readonly today = signal(calendarDate(new Date(), this.zone));
  readonly month = signal(this.today().slice(0, 7));
  readonly entries = signal<Absence[]>([]);
  readonly closures = signal<string[]>([]);
  readonly closureLoading = signal(false);
  readonly selected = signal<ReadonlyMap<string, string>>(new Map());
  readonly selectedIds = computed(() => [...this.selected().keys()]);
  readonly people = signal<Page<Row>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly file = signal<File | null>(null);
  readonly report = signal<ImportReport | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly peopleLoading = signal(false);
  readonly busy = signal(false);
  readonly exporting = signal(false);
  readonly daysOfWeek = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  readonly days = computed<Day[]>(() => {
    const [year, month] = this.month().split('-').map(Number);
    const holidays = italianHolidays(year);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const start = new Date(first);
    start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const count = Math.ceil((((first.getUTCDay() + 6) % 7) + lastDay) / 7) * 7;
    return Array.from({ length: count }, (_, index) => {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + index);
      const next = new Date(current);
      next.setUTCDate(next.getUTCDate() + 1);
      const date = current.toISOString().slice(0, 10);
      const nextDate = next.toISOString().slice(0, 10);
      const inMonth = current.getUTCMonth() === month - 1;
      return {
        date,
        number: current.getUTCDate(),
        inMonth,
        holiday: inMonth ? (holidays.get(date) ?? null) : null,
        closed: inMonth && this.closures().includes(date),
        items: inMonth
          ? this.entries().filter(
              (item) => item.startsAt < nextDate + 'T00:00:00' && item.endsAt > date + 'T00:00:00',
            )
          : [],
      };
    });
  });
  q = '';
  pageIndex = 0;
  private calendarGeneration = 0;
  private peopleGeneration = 0;
  private closureGeneration = 0;
  private peopleSearchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const timer = setInterval(() => this.today.set(calendarDate(new Date(), this.zone)), 60_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      if (this.peopleSearchTimer) clearTimeout(this.peopleSearchTimer);
    });
    void this.loadCalendar();
    void this.loadPeople();
    void this.loadClosures();
  }

  async loadCalendar(): Promise<void> {
    const generation = ++this.calendarGeneration;
    this.loading.set(true);
    this.error.set('');
    try {
      const ids = [...this.selected().keys()].join(',');
      const entries = await this.api.get<Absence[]>('absences', {
        month: this.month(),
        ...(ids ? { personIds: ids } : {}),
      });
      if (generation === this.calendarGeneration) this.entries.set(entries);
    } catch (error) {
      if (generation === this.calendarGeneration) {
        this.entries.set([]);
        this.error.set(errorMessage(error));
      }
    } finally {
      if (generation === this.calendarGeneration) this.loading.set(false);
    }
  }

  async loadPeople(): Promise<void> {
    const generation = ++this.peopleGeneration;
    this.peopleLoading.set(true);
    try {
      const people = await this.api.get<Page<Row>>('people', {
        q: this.q,
        includeArchived: true,
        page: this.pageIndex,
        size: 20,
        sort: 'lastName,asc',
      });
      if (generation === this.peopleGeneration) this.people.set(people);
    } catch (error) {
      if (generation === this.peopleGeneration) this.error.set(errorMessage(error));
    } finally {
      if (generation === this.peopleGeneration) this.peopleLoading.set(false);
    }
  }

  searchPeople(query: string): void {
    this.q = query;
    this.pageIndex = 0;
    if (this.peopleSearchTimer) clearTimeout(this.peopleSearchTimer);
    this.peopleSearchTimer = setTimeout(() => {
      void this.loadPeople();
      this.peopleSearchTimer = undefined;
    }, 250);
  }
  paginate(event: PageEvent): void {
    if (this.peopleSearchTimer) clearTimeout(this.peopleSearchTimer);
    this.peopleSearchTimer = undefined;
    this.pageIndex = event.pageIndex;
    void this.loadPeople();
  }

  selectablePeople(): { id: string; label: string }[] {
    const options = new Map([...this.selected()].map(([id, label]) => [id, { id, label }]));
    for (const person of this.people().items) {
      options.set(person.id, {
        id: person.id,
        label: `${person['lastName']} ${person['firstName']}${person['archivedAt'] ? ' (archiviata)' : ''}`,
      });
    }
    return [...options.values()];
  }

  updateSelection(ids: string[]): void {
    if (ids.length > 100) {
      this.error.set('Puoi selezionare al massimo 100 persone.');
      return;
    }
    const labels = new Map(this.selectablePeople().map(({ id, label }) => [id, label]));
    this.selected.set(new Map(ids.map((id) => [id, labels.get(id) ?? id])));
    void this.loadCalendar();
  }

  clearSelection(): void {
    this.selected.set(new Map());
    void this.loadCalendar();
  }

  changeMonth(delta: number): void {
    const [year, month] = this.month().split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    this.month.set(date.toISOString().slice(0, 7));
    void this.loadCalendar();
    void this.loadClosures();
  }

  goToToday(): void {
    const today = calendarDate(new Date(), this.zone);
    this.today.set(today);
    this.month.set(today.slice(0, 7));
    void this.loadCalendar();
    void this.loadClosures();
  }

  async exportCapacity(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.error.set('');
    try {
      const blob = await this.api.download('absences/capacity.xlsx');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'assenze-capacity.xlsx';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.exporting.set(false);
    }
  }

  compact(item: Absence): string {
    const initial = Array.from(item.firstName.trim())[0]?.toLocaleUpperCase('it-IT') ?? '';
    const rawHours = item.hours.trim();
    const lastSeparator = Math.max(rawHours.lastIndexOf(','), rawHours.lastIndexOf('.'));
    const normalizedHours =
      lastSeparator < 0
        ? rawHours
        : `${rawHours.slice(0, lastSeparator).replace(/[,.]/g, '')}.${rawHours.slice(lastSeparator + 1)}`;
    const numericHours = Number(normalizedHours);
    const hours = (Number.isFinite(numericHours) && numericHours > 8 ? '8' : rawHours)
      .trim()
      .replace(/([,.]\d*?[1-9])0+$/, '$1')
      .replace(/[,.]0+$/, '');
    return `${item.lastName} ${initial}. ${hours}h`;
  }

  async loadClosures(): Promise<void> {
    const generation = ++this.closureGeneration;
    this.closureLoading.set(true);
    try {
      const dates = await this.api.get<string[]>('company-closures', { month: this.month() });
      if (generation === this.closureGeneration) this.closures.set(dates);
    } catch (error) {
      if (generation === this.closureGeneration) {
        this.closures.set([]);
        this.error.set(errorMessage(error));
      }
    } finally {
      if (generation === this.closureGeneration) this.closureLoading.set(false);
    }
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.report.set(null);
    this.error.set('');
    const file = input.files?.[0] ?? null;
    if (file && (file.size === 0 || file.size > 2 * 1024 * 1024)) {
      this.file.set(null);
      input.value = '';
      this.error.set('Scegli un file CSV o XLSX non vuoto di massimo 2 MiB.');
      return;
    }
    if (file && !/\.(csv|xlsx)$/i.test(file.name)) {
      this.file.set(null);
      input.value = '';
      this.error.set('Scegli un file CSV o XLSX.');
      return;
    }
    this.file.set(file);
  }

  async importFile(): Promise<void> {
    const file = this.file();
    if (!file || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.report.set(null);
    try {
      const contentType = /\.xlsx$/i.test(file.name)
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv';
      this.report.set(await this.api.postFile<ImportReport>('absences/import', file, contentType));
      await this.loadCalendar();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
