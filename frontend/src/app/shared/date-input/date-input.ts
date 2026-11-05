import { Component, forwardRef, input } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerIntl, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export function parseDateInput(text: string, instant = false): string | null {
  const match = instant
    ? /^(\d{2})\/(\d{2})\/([1-9]\d{3}) (\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?$/.exec(text)
    : /^(\d{2})\/(\d{2})\/([1-9]\d{3})$/.exec(text);
  if (!match) return null;
  const [, day, month, year, hour = '00', minute = '00', second = '00'] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCHours() !== Number(hour) ||
    date.getUTCMinutes() !== Number(minute) ||
    date.getUTCSeconds() !== Number(second)
  )
    return null;
  return `${year}-${month}-${day}${instant ? `T${hour}:${minute}${match[6] ? `:${second}${match[7] ?? ''}` : ''}` : ''}`;
}

export function dateInputDisplay(value: string): string {
  const [date, time] = value.replace(/Z$/, '').split('T');
  return date.split('-').reverse().join('/') + (time ? ` ${time}` : '');
}

@Component({
  selector: 'app-date-input',
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'it-IT' },
    {
      provide: MatDatepickerIntl,
      useFactory: () => {
        const intl = new MatDatepickerIntl();
        intl.openCalendarLabel = 'Apri calendario';
        intl.closeCalendarLabel = 'Chiudi calendario';
        intl.prevMonthLabel = 'Mese precedente';
        intl.nextMonthLabel = 'Mese successivo';
        intl.prevYearLabel = 'Anno precedente';
        intl.nextYearLabel = 'Anno successivo';
        intl.switchToMonthViewLabel = 'Scegli una data';
        intl.switchToMultiYearViewLabel = 'Scegli mese e anno';
        return intl;
      },
    },
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateInput), multi: true },
  ],
  templateUrl: './date-input.html',
  styleUrl: './date-input.scss',
})
export class DateInput implements ControlValueAccessor, Validator {
  private static nextId = 0;
  readonly errorId = `date-error-${DateInput.nextId++}`;
  readonly label = input.required<string>();
  readonly instant = input(false);
  readonly required = input(false);
  text = '';
  disabled = false;
  private touched = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get invalid(): boolean {
    return (this.touched || !!this.text) && !!this.validate();
  }
  get calendarValue(): Date | null {
    const iso = parseDateInput(this.text, this.instant());
    if (!iso) return null;
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  writeValue(value: string | null): void {
    if (!value) {
      this.text = '';
      return;
    }
    this.text = dateInputDisplay(value);
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }
  validate(): ValidationErrors | null {
    if (!this.text) return this.required() ? { required: true } : null;
    return parseDateInput(this.text, this.instant()) ? null : { dateInput: true };
  }
  change(text: string): void {
    this.text = text;
    this.onChange(text ? (parseDateInput(text, this.instant()) ?? text) : '');
  }
  touch(): void {
    this.touched = true;
    this.onTouched();
  }
  choose(date: Date | null): void {
    if (!date) return;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const time = this.instant() ? ` ${this.text.split(' ')[1] || '00:00'}` : '';
    this.change(`${day}/${month}/${date.getFullYear()}${time}`);
    this.touch();
  }
}
