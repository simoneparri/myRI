import { TestBed } from '@angular/core/testing';
import { DisplayPipe, TIMEZONE } from './format';

describe('display formatting', () => {
  it('limits table previews to 250 characters with dots only when needed', () => {
    const pipe = TestBed.runInInjectionContext(() => new DisplayPipe());
    for (const text of ['a'.repeat(249), 'a'.repeat(250), 'active']) {
      expect(pipe.transform(text, 'preview')).toBe(text);
    }
    expect(pipe.transform('a'.repeat(251), 'preview')).toBe('a'.repeat(250) + '...');
    expect(pipe.transform('😀'.repeat(251), 'preview')).toBe('😀'.repeat(250) + '...');
    expect(pipe.transform(null, 'preview')).toBe('-');
    expect(pipe.transform('', 'preview')).toBe('-');
    expect(pipe.transform('a'.repeat(251), 'textarea')).toBe('a'.repeat(251));
  });
  it('uses the configured timezone, not the browser timezone, and preserves civil dates', () => {
    TestBed.configureTestingModule({ providers: [{ provide: TIMEZONE, useValue: 'Europe/Rome' }] });
    const pipe = TestBed.runInInjectionContext(() => new DisplayPipe());
    expect(pipe.transform('2026-01-15T23:30:00Z', 'instant')).toContain('16/01/2026');
    expect(pipe.transform('2026-01-15T23:30:00Z', 'instant')).toContain('00:30');
    expect(pipe.transform('2026-01-15', 'date')).toBe('15/01/2026');
    expect(pipe.transform('9999999999.99', 'decimal')).toBe('9.999.999.999,99');
  });
  it('always shows two decimals for money without floating point conversions', () => {
    const pipe = TestBed.runInInjectionContext(() => new DisplayPipe());
    expect(pipe.transform('45000', 'money')).toBe('45.000,00');
    expect(pipe.transform('45000.5', 'money')).toBe('45.000,50');
    expect(pipe.transform('0', 'money')).toBe('0,00');
    expect(pipe.transform('9999999999.99', 'money')).toBe('9.999.999.999,99');
    expect(pipe.transform('12.1234', 'decimal')).toBe('12,1234');
  });
});
