import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api, errorMessage } from '../../core/api';
import { calendarDate, TIMEZONE } from '../../shared/format';
import { DateInput } from '../../shared/date-input/date-input';

@Component({
  selector: 'app-company-closures',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, DateInput],
  templateUrl: './company-closures.html',
  styleUrl: './company-closures.scss',
})
export class CompanyClosures {
  private readonly api = inject(Api);
  readonly month = signal(calendarDate(new Date(), inject(TIMEZONE)).slice(0, 7));
  readonly closures = signal<string[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loadFailed = signal(false);
  closureDate = '';
  private generation = 0;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.loadFailed.set(false);
    try {
      const dates = await this.api.get<string[]>('company-closures', { month: this.month() });
      if (generation === this.generation) this.closures.set(dates);
    } catch (error) {
      if (generation === this.generation) {
        this.closures.set([]);
        this.loadFailed.set(true);
        this.error.set(errorMessage(error));
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  changeMonth(month: string): void {
    if (!/^(?:[1-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(month) || month > '9998-12') return;
    this.month.set(month);
    void this.load();
  }

  stepMonth(delta: -1 | 1): void {
    if (this.busy()) return;
    const [year, month] = this.month().split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    const next = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    this.changeMonth(next);
  }

  async update(date: string, cancel = false): Promise<void> {
    if (!date || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post<void>(cancel ? 'company-closures/cancel' : 'company-closures', { date });
      if (!cancel) {
        this.closureDate = '';
        this.month.set(date.slice(0, 7));
      }
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
