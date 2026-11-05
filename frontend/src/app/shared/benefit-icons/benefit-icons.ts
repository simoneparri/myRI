import { Component, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Row } from '../../core/api';
import { ButtonIcon, IconName } from '../button-icon/button-icon';
import { moneyDisplay } from '../format';

@Component({
  selector: 'app-benefit-icons',
  imports: [ButtonIcon, MatTooltipModule],
  templateUrl: './benefit-icons.html',
  styleUrl: './benefit-icons.scss',
})
export class BenefitIcons {
  readonly row = input.required<Row>();
  readonly benefits: { key: string; label: string; icon: IconName }[] = [
    { key: 'mealVouchers', label: 'Buoni pasto', icon: 'meal' },
    { key: 'bonusLetterAmount', label: 'Lettera di bonus', icon: 'bonus' },
    { key: 'companyCar', label: 'Auto', icon: 'car' },
  ];
  specified(key: string): boolean {
    return this.row()[key] !== null && this.row()[key] !== undefined;
  }
  hasBenefits(): boolean {
    return this.benefits.some((benefit) => this.specified(benefit.key));
  }
  label(key: string, label: string): string {
    const value = this.row()[key];
    return `${label}: ${
      key === 'bonusLetterAmount' ? moneyDisplay(String(value)) : value === true ? 'Si' : 'No'
    }`;
  }
}
