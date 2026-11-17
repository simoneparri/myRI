import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Api, Page, Row, errorMessage } from '../../core/api';
import { italianPaginator } from '../../shared/paginator';

interface TransferResult {
  sourceId: string;
  personId: string | null;
  status: 'imported' | 'skipped';
  reason: 'rsno_agresso' | 'mypad_id' | 'rsno_agresso,mypad_id' | null;
}
interface TransferReport {
  imported: number;
  skipped: number;
  results: TransferResult[];
}
const emptyPage: Page<Row> = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
const maxBytes = 10 * 1024 * 1024;

@Component({
  selector: 'app-import-export',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  templateUrl: './import-export.html',
  styleUrl: './import-export.scss',
})
export class ImportExport {
  private readonly api = inject(Api);
  readonly data = signal<Page<Row>>(emptyPage);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly selectedCount = computed(() => this.selected().size);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly report = signal<TransferReport | null>(null);
  readonly file = signal<File | null>(null);
  readonly consent = signal(false);
  q = '';
  includeArchived = false;
  pageIndex = 0;
  private generation = 0;

  constructor() {
    void this.load();
  }

  search(): void {
    this.pageIndex = 0;
    void this.load();
  }

  paginate(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    void this.load();
  }

  toggle(id: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked && next.size >= 100) {
      this.error.set('Puoi selezionare al massimo 100 persone.');
      return;
    }
    if (checked) next.add(id);
    else next.delete(id);
    this.selected.set(next);
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.get<Page<Row>>('people', {
        q: this.q,
        includeArchived: this.includeArchived,
        page: this.pageIndex,
        size: 20,
        sort: 'lastName,asc',
      });
      if (generation === this.generation) this.data.set(data);
    } catch (error) {
      if (generation === this.generation) {
        this.data.set(emptyPage);
        this.error.set(errorMessage(error));
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  async exportFile(): Promise<void> {
    if (this.busy() || !this.selectedCount()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const blob = await this.api.download('transfers/export', { personIds: [...this.selected()] });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'myri-transfer.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.report.set(null);
    this.error.set('');
    this.consent.set(false);
    const file = input.files?.[0] ?? null;
    if (file && (file.size === 0 || file.size > maxBytes)) {
      this.file.set(null);
      input.value = '';
      this.error.set('Scegli un file JSON non vuoto di massimo 10 MiB.');
      return;
    }
    this.file.set(file);
  }

  async importFile(): Promise<void> {
    const file = this.file();
    if (this.busy() || !file || !this.consent()) return;
    this.busy.set(true);
    this.error.set('');
    this.report.set(null);
    try {
      // Send the original JSON: parsing through JavaScript numbers could lose precision.
      const report = await this.api.postJson<TransferReport>('transfers/import', await file.text());
      this.report.set(report);
      this.consent.set(false);
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
