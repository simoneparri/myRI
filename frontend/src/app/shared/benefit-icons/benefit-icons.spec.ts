import { TestBed } from '@angular/core/testing';
import { BenefitIcons } from './benefit-icons';

describe('BenefitIcons', () => {
  it('shows false and zero as specified benefits, with accessible descriptions', async () => {
    const fixture = TestBed.createComponent(BenefitIcons);
    fixture.componentRef.setInput('row', {
      mealVouchers: false,
      bonusLetterAmount: '0.00',
      companyCar: true,
    });
    await fixture.whenStable();
    const icons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="img"]')];
    expect(icons.map((icon) => icon.getAttribute('aria-label'))).toEqual([
      'Buoni pasto: No',
      'Lettera di bonus: 0,00',
      'Auto: Si',
    ]);
    expect(icons[0].classList.contains('negative')).toBe(true);
    expect(icons.every((icon) => icon.getAttribute('tabindex') === '0')).toBe(true);
    fixture.componentRef.setInput('row', { mealVouchers: null, bonusLetterAmount: null });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[role="img"]')).toHaveLength(0);
    expect(fixture.nativeElement.textContent.trim()).toBe('-');
  });
});
