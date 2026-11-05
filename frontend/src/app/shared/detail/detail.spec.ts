import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { definitions } from '../schema';
import { Detail } from './detail';

describe('Detail percentage formatting', () => {
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
