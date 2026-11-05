import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { definitions } from '../schema';
import { Detail } from './detail';

describe('Detail percentage formatting', () => {
  it('renders the saved nested raise proposal, including No, zero and cleared values', async () => {
    TestBed.configureTestingModule({
      imports: [Detail],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            row: {
              id: '1',
              benefits: { mealVouchers: false, bonusLetterAmount: '0.00', companyCar: null },
            },
            definition: definitions['raise-requests'],
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Detail);
    await fixture.whenStable();
    const terms = [...(fixture.nativeElement as HTMLElement).querySelectorAll('dt')];
    for (const [label, value] of [
      ['Buoni pasto', 'No'],
      ['Lettera di bonus', '0,00'],
      ['Auto', '-'],
    ]) {
      expect(
        terms.find((term) => term.textContent === label)?.nextElementSibling?.textContent?.trim(),
      ).toBe(value);
    }
  });
  it('groups benefits and shows false, null and a zero bonus distinctly', async () => {
    TestBed.configureTestingModule({
      imports: [Detail],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            row: { id: '1', mealVouchers: false, bonusLetterAmount: '0.00', companyCar: null },
            definition: definitions.salaries,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Detail);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h3')?.textContent).toBe('Benefit');
    const terms = [...element.querySelectorAll('dt')];
    for (const [label, value] of [
      ['Buoni pasto', 'No'],
      ['Lettera di bonus', '0,00'],
      ['Auto', '-'],
    ]) {
      expect(
        terms.find((term) => term.textContent === label)?.nextElementSibling?.textContent?.trim(),
      ).toBe(value);
    }
  });
  it('keeps metadata order, optional visibility, raw notes and reference prefixes', async () => {
    TestBed.configureTestingModule({
      imports: [Detail],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            row: {
              id: '1',
              status: 'approved',
              outcomeOn: '2026-11-03',
              outcomeNotes: 'active',
              salaryId: '2',
              sourceTaskId: '3',
              completedAt: '2026-11-03T11:00:00Z',
            },
            definition: { singular: 'fittizia', fields: [], columns: [] },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Detail);
    fixture.componentInstance.fieldRows.splice(1, 0, [], []);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('hr')).toHaveLength(2);
    expect(element.querySelector('mat-dialog-content')?.children[1].tagName).toBe('HR');
    expect(element.querySelector('mat-dialog-content')?.children[2].tagName).toBe('HR');
    expect([...element.querySelectorAll('dt')].map((item) => item.textContent?.trim())).toEqual([
      'ID',
      'Stato',
      'Data esito',
      'Note esito',
      'RAL generata',
      'Task origine',
      'Completato',
    ]);
    expect([...element.querySelectorAll('dd')].map((item) => item.textContent?.trim())).toEqual([
      '1',
      'Approvata',
      '03/11/2026',
      'active',
      '#2',
      '#3',
      '03/11/2026, 12:00',
    ]);
  });

  it('shows raise percentage points with two decimals and a percent sign', async () => {
    TestBed.configureTestingModule({
      imports: [Detail],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            row: { id: '1', requestedPercentage: '5.8', requestedSalary: '45000.50' },
            definition: definitions['raise-requests'],
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Detail);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('5,80%');
    expect(element.textContent).toContain('45.000,50');
  });
});
