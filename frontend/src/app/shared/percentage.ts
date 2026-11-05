import { Pipe, PipeTransform } from '@angular/core';
import { Value } from '../core/api';

@Pipe({ name: 'percentage', standalone: true })
export class PercentagePipe implements PipeTransform {
  transform(value: Value | undefined, representation: 'fraction' | 'points' = 'fraction'): string {
    if (value === null || value === undefined || value === '') return '-';
    if (
      (typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !/^[+-]?\d+(?:\.\d+)?$/.test(value)) ||
      !Number.isFinite(Number(value))
    ) {
      throw new Error('Valore percentuale non valido.');
    }
    const formatted = new Intl.NumberFormat('it-IT', {
      style: representation === 'fraction' ? 'percent' : 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
    return representation === 'points' ? `${formatted}%` : formatted;
  }
}
