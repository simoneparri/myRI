import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { Api, Row } from '../core/api';
import { Editor } from '../shared/editor';
import { definitions } from '../shared/schema';
import { PersonPage } from './person-page';
import { Toast } from '../shared/toast';

describe('PersonPage', () => {
  const person: Row = {
    id: '9007199254740993',
    version: '4',
    firstName: 'Persona',
    lastName: 'Fittizia',
    email: 'persona@example.test',
    phone: 'Recapito fittizio',
    role: 'Ruolo fittizio',
    hiredOn: '2020-01-02',
    hiringLocation: 'Sede fittizia',
    residence: 'Residenza fittizia',
    managerId: '9007199254740994',
    externalManager: null,
    notes: 'Note fittizie\nSeconda riga',
    status: 'active',
    seniority: '6 anni',
    careerStartedOn: '2017-01-02',
    careerDuration: '9 anni e 10 mesi',
    seniorityLevel: 'senior',
    mypadId: 'fictitious-123',
  };
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  const get = vi.fn();
  const open = vi.fn();
  const success = vi.fn();

  async function create(row: Row = person) {
    success.mockReset();
    get
      .mockReset()
      .mockImplementation(async (path: string) => (path.endsWith('/timeline') ? empty : row));
    open.mockReset().mockReturnValue({ afterClosed: () => of(false) });
    TestBed.configureTestingModule({
      imports: [PersonPage],
      providers: [
        provideRouter([]),
        { provide: Api, useValue: { get } },
        { provide: MatDialog, useValue: { open } },
        { provide: Toast, useValue: { success } },
      ],
    });
    const fixture = TestBed.createComponent(PersonPage);
    fixture.componentRef.setInput('id', person.id);
    await fixture.whenStable();
    return fixture;
  }

  it('shows both dates with elapsed time, seniority level and a separate MyPad ID', async () => {
    const fixture = await create();
    const element = fixture.nativeElement as HTMLElement;
    const details = element.querySelector('dl')!;
    expect([...details.querySelectorAll('dt')].map((label) => label.textContent)).toEqual([
      ...definitions.people.fields.map((field) => field.label),
    ]);
    for (const value of [
      'persona@example.test',
      'Recapito fittizio',
      '02/01/2020',
      'Sede fittizia',
      'Residenza fittizia',
      '9007199254740994',
      'Note fittizie\nSeconda riga',
      'Attiva',
      '6 anni',
      '02/01/2017',
      '9 anni e 10 mesi',
      'Senior',
      'fictitious-123',
    ]) {
      expect(details.textContent).toContain(value);
    }
    expect(details.textContent).not.toContain(person.id);
    const link = details.querySelector('a')!;
    expect(link.href).toBe('https://mypad.altengroup.com/employees/fictitious-123');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    for (const button of element.querySelectorAll('button:not(.mat-mdc-paginator button), a')) {
      expect(button.querySelector('svg[aria-hidden="true"] path')).not.toBeNull();
    }
  });
  it('does not link to MyPad when its ID is missing or malformed', async () => {
    const fixture = await create({ ...person, mypadId: null });
    expect((fixture.nativeElement as HTMLElement).querySelector('dl a')).toBeNull();
    expect(fixture.componentInstance.mypadUrl({ id: '1', mypadId: '../other?query=1' })).toBeNull();
    expect(
      fixture.componentInstance.mypadUrl({ id: '1', mypadId: 'https://other.test' }),
    ).toBeNull();
  });

  it('opens the existing versioned editor from the sheet and reloads saved information', async () => {
    const fixture = await create();
    const updated = { ...person, role: 'Ruolo aggiornato' };
    open.mockReturnValue({ afterClosed: () => of(true) });
    get.mockImplementation(async (path: string) => (path.endsWith('/timeline') ? empty : updated));
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Modifica',
    )!;
    button.click();
    await fixture.whenStable();
    expect(open).toHaveBeenCalledWith(Editor, {
      data: { resource: 'people', path: 'people', row: person },
      width: '720px',
      maxWidth: '95vw',
    });
    expect(fixture.componentInstance.person()).toEqual(updated);
    expect((fixture.nativeElement as HTMLElement).querySelector('dl')?.textContent).toContain(
      'Ruolo aggiornato',
    );
    expect(success).toHaveBeenCalledExactlyOnceWith('Salvataggio completato.');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Dati salvati.');
    expect(fixture.componentInstance.editing()).toBe(false);
  });

  it('does not reload when editing is cancelled', async () => {
    const fixture = await create();
    get.mockClear();
    await fixture.componentInstance.edit();
    expect(get).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('keeps archived people readable without offering editing', async () => {
    const fixture = await create({ ...person, archivedAt: '2026-11-04T10:00:00Z' });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('dl')?.textContent).toContain('Archiviato');
    expect(
      [...element.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === 'Modifica',
      ),
    ).toBe(false);
    await fixture.componentInstance.edit();
    expect(open).not.toHaveBeenCalled();
  });

  it('surfaces a reload failure after editing instead of showing stale details', async () => {
    const fixture = await create();
    open.mockReturnValue({ afterClosed: () => of(true) });
    get.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    await fixture.componentInstance.edit();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role=alert]')?.textContent).toContain('Operazione non riuscita');
    expect(element.querySelector('dl')).toBeNull();
    expect(fixture.componentInstance.editing()).toBe(false);
  });
});
