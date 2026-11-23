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
