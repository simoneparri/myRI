import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../../core/api';
import { SalaryComparison } from './salary-comparison';

describe('SalaryComparison', () => {
  const row = {
    personId: '7',
    firstName: 'Ada',
    lastName: 'Esempio',
    role: 'Sviluppatrice fittizia',
    seniorityLevel: 'senior',
    status: 'active',
    archivedAt: null,
    bornOn: '1990-01-01',
    age: 36,
    hiredOn: '2020-11-03',
    seniority: '6 anni e 0 mesi',
    salaryId: '3',
    amount: '35000.50',
    currency: 'EUR',
    effectiveOn: '2026-01-01',
    classificationLevel: 'B2',
    mealVouchers: true,
    bonusLetterAmount: null,
    companyCar: false,
  };
  const page = { items: [row], page: 0, size: 20, totalElements: 1, totalPages: 1 };

  it('renders the current salary comparison and reloads with sort and archive filters', async () => {
    const get = vi.fn().mockResolvedValue(page);
    TestBed.configureTestingModule({
      imports: [SalaryComparison],
      providers: [provideRouter([]), { provide: Api, useValue: { get } }],
    });
    const fixture = TestBed.createComponent(SalaryComparison);
    await fixture.whenStable();
    expect(get).toHaveBeenCalledWith('salary-comparison', {
      includeArchived: false,
      page: 0,
      size: 20,
      sort: 'lastName,asc',
    });
    const element = fixture.nativeElement as HTMLElement;
    expect([...element.querySelectorAll('th')].map((th) => th.textContent?.trim())).toEqual(
      fixture.componentInstance.columns.map((column) => column.label),
    );
    const cells = [...element.querySelectorAll('tbody td')].map((td) => td.textContent?.trim());
    expect(cells[0]).toBe('Esempio Ada');
    expect(element.querySelector('tbody a')?.getAttribute('href')).toBe('/people/7');
    expect(cells).toContain('Sviluppatrice fittizia');
    expect(cells).toContain('Senior');
    expect(cells).toContain('B2');
    expect(cells[4]).toContain('35.000,50 EUR');
    expect(cells[4]).toContain('dal 01/01/2026');
    expect(element.querySelector('[aria-label="Buoni pasto: Si"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="Auto: No"]')).not.toBeNull();
    expect(cells[6]).toBe('36');
    expect(cells[7]).toContain('6 anni e 0 mesi');

    fixture.componentInstance.sort = 'amount,desc';
    fixture.componentInstance.includeArchived = true;
    fixture.componentInstance.pageIndex = 2;
    fixture.componentInstance.search();
    await fixture.whenStable();
    expect(get).toHaveBeenLastCalledWith('salary-comparison', {
      includeArchived: true,
      page: 0,
      size: 20,
      sort: 'amount,desc',
    });
  });

  it('shows errors and the empty state', async () => {
    const get = vi.fn().mockRejectedValue(new Error('Errore fittizio'));
    TestBed.configureTestingModule({
      imports: [SalaryComparison],
      providers: [provideRouter([]), { provide: Api, useValue: { get } }],
    });
    const fixture = TestBed.createComponent(SalaryComparison);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    get.mockResolvedValue({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    await fixture.componentInstance.load();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Nessuna persona con RAL corrente.');
  });
});
