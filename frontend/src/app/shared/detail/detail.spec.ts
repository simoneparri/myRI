import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { definitions } from '../schema';
import { Detail } from './detail';

describe('Detail percentage formatting', () => {
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
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
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
