import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { Api, Page, Row, errorMessage } from '../../core/api';
import { BenefitIcons } from '../../shared/benefit-icons/benefit-icons';
import { ButtonIcon } from '../../shared/button-icon/button-icon';
import { DisplayPipe } from '../../shared/format';
import { italianPaginator } from '../../shared/paginator';

type ComparisonColumn = {
  key: string;
  label: string;
  type: 'person' | 'text' | 'display' | 'money' | 'benefits' | 'age' | 'tenure';
};

const emptyPage: Page<Row> = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };

@Component({
  selector: 'app-salary-comparison',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatSelectModule,
    BenefitIcons,
    ButtonIcon,
    DisplayPipe,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: italianPaginator }],
  templateUrl: './salary-comparison.html',
  styleUrl: './salary-comparison.scss',
})
export class SalaryComparison {
  private readonly api = inject(Api);
  readonly columns: readonly ComparisonColumn[] = [
    { key: 'lastName', label: 'Persona', type: 'person' },
    { key: 'role', label: 'Ruolo', type: 'text' },
    { key: 'seniorityLevel', label: 'Seniority', type: 'display' },
    { key: 'classificationLevel', label: 'Livello', type: 'text' },
    { key: 'amount', label: 'RAL annua', type: 'money' },
    { key: 'benefits', label: 'Benefit', type: 'benefits' },
    { key: 'age', label: 'Età', type: 'age' },
    { key: 'seniority', label: 'Anzianità aziendale', type: 'tenure' },
  ];
  readonly sorts = [
    { value: 'lastName,asc', label: 'Cognome (A-Z)' },
    { value: 'amount,desc', label: 'RAL decrescente' },
    { value: 'amount,asc', label: 'RAL crescente' },
    { value: 'hiredOn,asc', label: 'Anzianità decrescente' },
    { value: 'bornOn,asc', label: 'Età decrescente' },
    { value: 'role,asc', label: 'Ruolo (A-Z)' },
    { value: 'seniorityLevel,asc', label: 'Seniority' },
  ];
  readonly data = signal<Page<Row>>(emptyPage);
  readonly error = signal('');
  readonly loading = signal(false);
  sort = 'lastName,asc';
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

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.get<Page<Row>>('salary-comparison', {
        includeArchived: this.includeArchived,
        page: this.pageIndex,
        size: 20,
        sort: this.sort,
      });
      if (generation === this.generation) this.data.set(data);
    } catch (error) {
      if (generation === this.generation) {
        this.error.set(errorMessage(error));
        this.data.set(emptyPage);
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
