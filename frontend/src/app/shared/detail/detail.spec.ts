import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { definitions } from '../schema';
import { Detail } from './detail';

describe('Detail percentage formatting', () => {
  it('preserves business identifiers and full notes in person details', async () => {
    TestBed.configureTestingModule({
      imports: [Detail],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            row: {
              id: '987654321',
              insideId: 'INSIDE-FITTIZIO',
              mypadId: 'MYPAD-FITTIZIO',
              notes: 'a'.repeat(251),
            },
            definition: definitions.people,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Detail);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('987654321');
    expect(element.textContent).toContain('INSIDE-FITTIZIO');
    expect(element.textContent).toContain('MYPAD-FITTIZIO');
    expect(element.textContent).toContain('a'.repeat(251));
  });
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
  it('keeps metadata order and full notes without exposing internal database IDs', async () => {
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
              outcomeNotes: 'a'.repeat(251),
              salaryId: '2',
              sourceTaskId: '3',
              sourceRaiseRequestId: '4',
              personId: '5',
              baseSalaryId: '6',
              completedAt: '2026-11-03T11:00:00Z',
            },
            definition: {
              singular: 'fittizia',
              fields: [
                { key: 'personId', label: 'Persona', type: 'id' },
                { key: 'baseSalaryId', label: 'RAL base', type: 'id' },
              ],
              columns: [],
            },
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
      'Stato',
      'Data esito',
      'Note esito',
      'Completato',
    ]);
    expect([...element.querySelectorAll('dd')].map((item) => item.textContent?.trim())).toEqual([
      'Approvata',
      '03/11/2026',
      'a'.repeat(251),
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
