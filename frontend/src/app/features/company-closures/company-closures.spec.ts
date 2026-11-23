import { TestBed } from '@angular/core/testing';
import { Api } from '../../core/api';
import { CompanyClosures } from './company-closures';

describe('CompanyClosures', () => {
  function setup() {
    const api = {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [CompanyClosures],
      providers: [{ provide: Api, useValue: api }],
    });
    const fixture = TestBed.createComponent(CompanyClosures);
    return { fixture, component: fixture.componentInstance, api };
  }

  it('switches to the added date month and cancels closures', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    api.get.mockResolvedValue(['2027-01-15']);
    await component.update('2027-01-15');
    expect(api.post).toHaveBeenCalledWith('company-closures', { date: '2027-01-15' });
    expect(component.month()).toBe('2027-01');
    expect(api.get).toHaveBeenLastCalledWith('company-closures', { month: '2027-01' });
    expect(component.closures()).toEqual(['2027-01-15']);
    await component.update('2027-01-15', true);
    expect(api.post).toHaveBeenLastCalledWith('company-closures/cancel', { date: '2027-01-15' });
  });

  it('ignores stale month responses', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    let finishOld!: (dates: string[]) => void;
    api.get.mockImplementationOnce(() => new Promise<string[]>((resolve) => (finishOld = resolve)));
    api.get.mockResolvedValueOnce(['2027-02-01']);
    component.changeMonth('2027-01');
    component.changeMonth('2027-02');
    await fixture.whenStable();
    finishOld(['2027-01-01']);
    await fixture.whenStable();
    expect(component.closures()).toEqual(['2027-02-01']);
    expect(component.loading()).toBe(false);
  });

  it('navigates months and year boundaries, respecting limits and busy state', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    component.changeMonth('2027-01');
    component.stepMonth(-1);
    await fixture.whenStable();
    expect(component.month()).toBe('2026-12');
    expect(api.get).toHaveBeenLastCalledWith('company-closures', { month: '2026-12' });
    component.stepMonth(1);
    await fixture.whenStable();
    expect(component.month()).toBe('2027-01');
    component.changeMonth('1000-01');
    fixture.detectChanges();
    const previous: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Mese precedente"]');
    const next: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Mese successivo"]');
    expect(previous.disabled).toBe(true);
    component.stepMonth(-1);
    expect(component.month()).toBe('1000-01');
    component.changeMonth('9998-12');
    fixture.detectChanges();
    expect(next.disabled).toBe(true);
    component.stepMonth(1);
    expect(component.month()).toBe('9998-12');
    component.busy.set(true);
    component.stepMonth(-1);
    fixture.detectChanges();
    expect(previous.disabled).toBe(true);
    expect(component.month()).toBe('9998-12');
  });

  it('reports load failures without presenting an empty result', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    api.get.mockRejectedValueOnce(new Error('failure'));
    await component.load();
    fixture.detectChanges();
    expect(component.error()).toContain('Operazione non riuscita');
    expect(fixture.nativeElement.textContent).toContain('Riprova caricamento');
    expect(fixture.nativeElement.textContent).not.toContain('Nessuna chiusura aziendale');
  });
});
