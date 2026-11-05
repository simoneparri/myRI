import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { Api, Page, Row, errorMessage } from '../../core/api';
import { DisplayPipe, TIMEZONE, calendarDate } from '../../shared/format';
import { italianPaginator } from '../../shared/paginator';
import { ButtonIcon } from '../../shared/button-icon/button-icon';

@Component({
  selector: 'app-salary-trend',
  imports: [MatPaginatorModule, MatButtonModule, DisplayPipe, ButtonIcon],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  templateUrl: './salary-trend.html',
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
