import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Api } from '../../core/api';
import { Absences } from './absences';
import { italianHolidays } from './italian-holidays';

describe('Absences', () => {
  const person = { id: '9007199254740993', firstName: 'Persona', lastName: 'Fittizia' };
  const absence = {
    id: '1',
    personId: person.id,
    firstName: 'Persona',
    lastName: 'Fittizia',
    startsAt: '2026-02-01T09:00:00',
    endsAt: '2026-02-02T00:00:00',
    code: 'F',
    label: 'Ferie',
    status: 'Approvata',
    days: '1',
    hours: '8',
    importedToTimesheet: 'Si',
  };
  function setup() {
    const api = {
      get: vi.fn((path: string) =>
        Promise.resolve(
          path === 'company-closures'
            ? []
            : path === 'people'
              ? { items: [person], page: 0, size: 20, totalElements: 1, totalPages: 1 }
              : [absence],
        ),
      ),
      postFile: vi.fn().mockResolvedValue({
        imported: 1,
        unchanged: 0,
        skipped: 1,
        replaced: 1,
        errors: [{ row: 3, reason: 'Dati non validi.' }],
      }),
      post: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue(new Blob(['fittizio'])),
    };
    TestBed.configureTestingModule({
      imports: [Absences],
      providers: [{ provide: Api, useValue: api }],
    });
    const fixture = TestBed.createComponent(Absences);
    return { fixture, component: fixture.componentInstance, api };
  }

  it('renders only the occupied calendar day and filters by string person ID', async () => {
    const { fixture, component, api } = setup();
    component.month.set('2026-02');
    await fixture.whenStable();
    expect(component.days().find((day) => day.date === '2026-02-01')?.items).toHaveLength(1);
    expect(component.days().find((day) => day.date === '2026-02-02')?.items).toHaveLength(0);
    component.toggle(person, true);
    await fixture.whenStable();
    expect(api.get).toHaveBeenCalledWith('absences', {
      month: '2026-02',
      personIds: '9007199254740993',
    });
    component.changeMonth(1);
    expect(component.month()).toBe('2026-03');
  });

  it('styles month navigation buttons like the today button', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    fixture.detectChanges();

    for (const label of ['Mese precedente', 'Mese successivo']) {
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        `[aria-label="${label}"]`,
      );
      expect(button.classList.contains('mat-mdc-outlined-button')).toBe(true);
    }
  });

  it('shows compact hours and holiday precedence', async () => {
    const { fixture, component } = setup();
    component.month.set('2026-12');
    await fixture.whenStable();
    component.entries.set([
      {
        ...absence,
        startsAt: '2026-12-25T09:00:00',
        endsAt: '2026-12-25T18:00:00',
        hours: '8,00',
      },
    ]);
    component.closures.set(['2026-12-25', '2026-12-24']);
    fixture.detectChanges();
    expect(component.compact({ ...absence, hours: '8,50' })).toBe('Fittizia P. 8h');
    expect(component.compact({ ...absence, hours: '1.000,00' })).toBe('Fittizia P. 8h');
    expect(component.compact({ ...absence, hours: '8,00' })).toBe('Fittizia P. 8h');
    expect(
      fixture.nativeElement
        .querySelector('[aria-label="2026-12-25"] .day-number')
        .classList.contains('holiday'),
    ).toBe(true);
    expect(
      fixture.nativeElement
        .querySelector('[aria-label="2026-12-25"] .day-number')
        .classList.contains('closure'),
    ).toBe(false);
    expect(
      fixture.nativeElement
        .querySelector('[aria-label="2026-12-24"] .day-number')
        .classList.contains('closure'),
    ).toBe(true);
  });

  it('computes Easter and fixed Italian holidays', () => {
    const holidays = italianHolidays(2026);
    expect(holidays.get('2026-04-05')).toBe('Pasqua');
    expect(holidays.get('2026-04-06')).toBe('Pasquetta');
    expect(holidays.get('2026-08-15')).toBe('Ferragosto');
    expect(holidays.get('2026-12-25')).toBe('Natale');
    expect(italianHolidays(2027).get('2027-03-28')).toBe('Pasqua');
  });

  it('returns to today and highlights it without losing holiday styling', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    const today = component.today();
    component.month.set('2020-01');
    component.goToToday();
    await fixture.whenStable();
    expect(component.month()).toBe(today.slice(0, 7));
    expect(api.get).toHaveBeenCalledWith('company-closures', { month: today.slice(0, 7) });
    component.closures.set([today]);
    fixture.detectChanges();
    const number: HTMLElement = fixture.nativeElement.querySelector(
      `[aria-label="${today}"] .day-number`,
    );
    expect(number.classList.contains('today')).toBe(true);
    expect(number.getAttribute('aria-current')).toBe('date');
    expect(number.classList.contains('closure') || number.classList.contains('holiday')).toBe(true);
  });

  it('exports all people independently of the current selection', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    component.toggle(person, true);
    const create = vi.fn().mockReturnValue('blob:fittizio');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      await component.exportCapacity();
      expect(api.download).toHaveBeenCalledWith('absences/capacity.xlsx');
      expect(click).toHaveBeenCalledOnce();
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(revoke).toHaveBeenCalledWith('blob:fittizio');
    } finally {
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('displays capacity export errors', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    api.download.mockRejectedValue(
      new HttpErrorResponse({ status: 400, error: { detail: 'Troppe persone per l’export.' } }),
    );
    await component.exportCapacity();
    fixture.detectChanges();
    expect(component.exporting()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Troppe persone per l’export.',
    );
  });
  it('uploads the original file and displays per-row results', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    const importButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.upload-actions button:last-child',
    );
    expect(importButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Nessun file selezionato');
    const file = new File(['csv fittizio'], 'assenze.csv', { type: 'text/csv' });
    component.chooseFile({ target: { files: [file] } } as unknown as Event);
    fixture.detectChanges();
    expect(importButton.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('assenze.csv');
    component.busy.set(true);
    fixture.detectChanges();
    const chooseButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.upload-actions button:first-of-type',
    );
    expect(chooseButton.disabled).toBe(true);
    expect(importButton.disabled).toBe(true);
    component.busy.set(false);
    await component.importFile();
    fixture.detectChanges();
    expect(api.postFile).toHaveBeenCalledWith('absences/import', file, 'text/csv');
    expect(fixture.nativeElement.textContent).toContain('Saltate: 1');
    expect(fixture.nativeElement.textContent).toContain('Record 3: Dati non validi.');
  });

  it('uploads XLSX with the spreadsheet content type and rejects other extensions', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    const file = new File(['fittizio'], 'ASSENZE.XLSX');
    component.chooseFile({ target: { files: [file] } } as unknown as Event);
    await component.importFile();
    expect(api.postFile).toHaveBeenCalledWith(
      'absences/import',
      file,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    component.chooseFile({
      target: { files: [new File(['x'], 'assenze.xls')], value: 'x' },
    } as unknown as Event);
    expect(component.file()).toBeNull();
    expect(component.error()).toContain('CSV o XLSX');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nessun file selezionato');
  });
});
