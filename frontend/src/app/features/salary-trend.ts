import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { Api, Page, Row, errorMessage } from '../core/api';
import { DisplayPipe, TIMEZONE, calendarDate } from '../shared/format';
import { italianPaginator } from '../shared/paginator';

@Component({
  selector: 'app-salary-trend',
  imports: [MatPaginatorModule, MatButtonModule, DisplayPipe],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  template: `
    <h2>Andamento RAL</h2>
    <p>
      Ordine crescente per decorrenza e ID. Le decorrenze future sono indicate; nessuna conversione
      tra valute.
    </p>
    <button mat-button (click)="load()" [disabled]="loading()">Aggiorna andamento</button>
    @if (error()) {
      <p role="alert" class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p role="status">Caricamento andamento...</p>
    } @else if (data().items.length === 0 && !error()) {
      <p>Nessuna variazione RAL.</p>
    }
    <div class="table-scroll">
      <table>
        <caption class="sr-only">
          Andamento cronologico della RAL
        </caption>
        <thead>
          <tr>
            <th>Decorrenza</th>
            <th>RAL annua</th>
            <th>Valuta</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          @for (item of data().items; track item.id) {
            <tr>
              <td>
                {{ item['effectiveOn'] | display: 'date' }}
                @if (future(item)) {
                  <span class="badge">Futura</span>
                }
              </td>
              <td>{{ item['amount'] | display: 'decimal' }}</td>
              <td>{{ item['currency'] }}</td>
              <td>{{ item['reason'] }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <mat-paginator
      [length]="data().totalElements"
      [pageIndex]="pageIndex"
      [pageSize]="20"
      (page)="paginate($event)"
      aria-label="Paginazione andamento RAL"
    ></mat-paginator>
  `,
})
export class SalaryTrend {
  readonly personId = input.required<string>();
  private readonly api = inject(Api);
  readonly timezone = inject(TIMEZONE);
  readonly data = signal<Page<Row>>({
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
    effect(() => {
      this.personId();
      untracked(() => {
        this.pageIndex = 0;
        void this.load();
      });
    });
  }
  future(row: Row): boolean {
    return String(row['effectiveOn']) > calendarDate(new Date(), this.timezone);
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
      const data = await this.api.get<Page<Row>>(`people/${this.personId()}/salary-trend`, {
        page: this.pageIndex,
        size: 20,
      });
      if (generation === this.generation) this.data.set(data);
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(errorMessage(error));
        this.data.set({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
