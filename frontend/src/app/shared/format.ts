import { InjectionToken, Pipe, PipeTransform, inject } from '@angular/core';
import { Row, Value } from '../core/api';

export const TIMEZONE = new InjectionToken<string>('TIMEZONE', { factory: () => 'Europe/Rome' });
export const labels: Record<string, string> = {
  active: 'Attiva',
  inactive: 'Non piu nel team',
  draft: 'Bozza',
  submitted: 'Inviata',
  approved: 'Approvata',
  rejected: 'Rifiutata',
  postponed: 'Rimandata',
  todo: 'Da fare',
  in_progress: 'In corso',
  done: 'Completato',
  cancelled: 'Annullato',
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  daily: 'Giornaliera',
  weekly: 'Settimanale',
  monthly: 'Mensile',
  salary: 'Variazione RAL',
  raise_request: 'Richiesta aumento',
  career_talk: 'Career talk',
  task: 'Task',
};

export function personLabel(row: Row): string {
  return `${row['firstName']} ${row['lastName']}${row['archivedAt'] ? ' (archiviata)' : ''}`;
}

export function decimalDisplay(value: string): string {
  const [whole, fraction] = value.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction ? ',' + fraction : '');
}

@Pipe({ name: 'display', standalone: true })
export class DisplayPipe implements PipeTransform {
  private readonly zone = inject(TIMEZONE);
  transform(value: Value | undefined, type = 'text'): string {
    if (value === null || value === undefined || value === '') return '-';
    const text = String(value);
    if (type === 'decimal') return decimalDisplay(text);
    if (type === 'date') return text.split('-').reverse().join('/');
    if (type === 'instant')
      return new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: this.zone,
      }).format(new Date(text));
    return labels[text] ?? text;
  }
}
