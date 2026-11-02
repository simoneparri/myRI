import { TestBed } from '@angular/core/testing';
import { DisplayPipe, TIMEZONE } from './format';

describe('display formatting', () => {
  it('uses the configured timezone, not the browser timezone, and preserves civil dates', () => {
    TestBed.configureTestingModule({ providers: [{ provide: TIMEZONE, useValue: 'Europe/Rome' }] });
    const pipe = TestBed.runInInjectionContext(() => new DisplayPipe());
    expect(pipe.transform('2026-01-15T23:30:00Z', 'instant')).toContain('16/01/26');
    expect(pipe.transform('2026-01-15T23:30:00Z', 'instant')).toContain('00:30');
    expect(pipe.transform('2026-01-15', 'date')).toBe('15/01/2026');
    expect(pipe.transform('9999999999.99', 'decimal')).toBe('9.999.999.999,99');
  });
});
