import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Api, Page, Row, errorMessage } from '../../core/api';
import { calendarDate, TIMEZONE } from '../../shared/format';
import { italianPaginator } from '../../shared/paginator';

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
}

@Component({
  selector: 'app-absences',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  templateUrl: './absences.html',
  styleUrl: './absences.scss',
})
export class Absences {
  private readonly api = inject(Api);
  private readonly zone = inject(TIMEZONE);
  readonly month = signal(calendarDate(new Date(), this.zone).slice(0, 7));
  readonly entries = signal<Absence[]>([]);
  readonly selected = signal<ReadonlyMap<string, string>>(new Map());
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
  readonly daysOfWeek = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  readonly days = computed<Day[]>(() => {
    const [year, month] = this.month().split('-').map(Number);
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

  constructor() {
    void this.loadCalendar();
    void this.loadPeople();
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

  search(): void {
    this.pageIndex = 0;
    void this.loadPeople();
  }
  paginate(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    void this.loadPeople();
  }

  toggle(person: Row, checked: boolean): void {
    const selected = new Map(this.selected());
    if (checked && selected.size >= 100) {
      this.error.set('Puoi selezionare al massimo 100 persone.');
      return;
    }
    if (checked) selected.set(person.id, `${person['lastName']} ${person['firstName']}`);
    else selected.delete(person.id);
    this.selected.set(selected);
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
