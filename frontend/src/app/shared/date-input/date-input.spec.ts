import { TestBed } from '@angular/core/testing';
import { DateInput, parseDateInput } from './date-input';

describe('date input', () => {
  it('parses Italian dates strictly and rejects impossible dates and times', () => {
    expect(parseDateInput('29/02/2024')).toBe('2024-02-29');
    expect(parseDateInput('29/02/2025')).toBeNull();
    expect(parseDateInput('31/04/2026')).toBeNull();
    expect(parseDateInput('01/13/2026')).toBeNull();
    expect(parseDateInput('1/2/2026')).toBeNull();
    expect(parseDateInput('2026-02-01')).toBeNull();
    expect(parseDateInput('04/11/2026 23:59', true)).toBe('2026-11-04T23:59');
    expect(parseDateInput('04/11/2026 24:00', true)).toBeNull();
    expect(parseDateInput('04/11/2026 12:60', true)).toBeNull();
    expect(parseDateInput('04/11/2026 12:00:60', true)).toBeNull();
  });

  it('round-trips API values and emits the same civil date selected in the calendar', () => {
    const fixture = TestBed.createComponent(DateInput);
    fixture.componentRef.setInput('label', 'Data');
    const input = fixture.componentInstance;
    const change = vi.fn();
    input.registerOnChange(change);
    input.writeValue('2026-01-02');
    expect(input.text).toBe('02/01/2026');
    input.choose(new Date(2026, 10, 4));
    expect(input.text).toBe('04/11/2026');
    expect(change).toHaveBeenLastCalledWith('2026-11-04');
    input.change('31/02/2026');
    expect(input.validate()).toEqual({ dateInput: true });
    input.change('');
    expect(change).toHaveBeenLastCalledWith('');
    expect(input.validate()).toBeNull();
    fixture.componentRef.setInput('required', true);
    expect(input.validate()).toEqual({ required: true });
  });

  it('preserves UTC time and seconds while changing only the calendar date', () => {
    const fixture = TestBed.createComponent(DateInput);
    fixture.componentRef.setInput('label', 'Scadenza (UTC)');
    fixture.componentRef.setInput('instant', true);
    const input = fixture.componentInstance;
    const change = vi.fn();
    input.registerOnChange(change);
    input.writeValue('2026-11-04T23:30:45.123');
    expect(input.text).toBe('04/11/2026 23:30:45.123');
    input.choose(new Date(2026, 10, 5));
    expect(change).toHaveBeenLastCalledWith('2026-11-05T23:30:45.123');
    expect(input.validate()).toBeNull();
    input.setDisabledState(true);
    expect(input.disabled).toBe(true);
  });
});
