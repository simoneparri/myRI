import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RowActions } from './row-actions';

describe('RowActions', () => {
  it('renders a direct action when there is one, otherwise a keyboard-accessible menu', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(RowActions);
    fixture.componentRef.setInput('actions', [
      { key: 'detail', label: 'Dettagli', icon: 'detail' },
    ]);
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[aria-label="Azioni"]')).toBeNull();
    element.querySelector('button')!.click();
    expect(selected).toHaveBeenLastCalledWith('detail');
    fixture.componentRef.setInput('actions', [
      { key: 'sheet', label: 'Scheda', icon: 'person', link: ['/people', '1'] },
      { key: 'archive', label: 'Archivia', icon: 'archive' },
    ]);
    await fixture.whenStable();
    const trigger = element.querySelector<HTMLButtonElement>('[aria-label="Azioni"]')!;
    expect(trigger.hasAttribute('mat-icon-button')).toBe(true);
    expect(trigger.textContent?.trim()).toBe('');
    expect(trigger.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('[aria-label="Azioni"]')!.click();
    await fixture.whenStable();
    expect(document.querySelector('a[role="menuitem"]')?.getAttribute('href')).toBe('/people/1');
    const archive = document.querySelector<HTMLButtonElement>('button[role="menuitem"]')!;
    expect(archive.textContent).toContain('Archivia');
    archive.click();
    expect(selected).toHaveBeenLastCalledWith('archive');
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(element.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
  });
});
