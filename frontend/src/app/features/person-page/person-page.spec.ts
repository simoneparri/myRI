import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { Api, Row } from '../../core/api';
import { Editor } from '../../shared/editor/editor';
import { definitions } from '../../shared/schema';
import { PersonPage } from './person-page';
import { Toast } from '../../shared/toast';

describe('PersonPage', () => {
  const person: Row = {
    id: '9007199254740993',
    version: '4',
    firstName: 'Persona',
    lastName: 'Fittizia',
    email: 'persona@example.test',
    phone: 'Recapito fittizio',
    role: 'Ruolo fittizio',
    frameworks: ['Java', 'Spring Boot'],
    hiredOn: '2020-01-02',
    bornOn: '1990-11-05',
    age: 36,
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
    rsnoAgresso: '00011',
    insideId: '00012',
    education: 'master',
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
    const details = element.querySelector('.person-details')!;
    expect([...details.querySelectorAll('dt')].map((label) => label.textContent)).toEqual([
      ...fixture.componentInstance.fieldRows
        .flat()
        .map((field) => (field.key === 'frameworks' ? 'Framework conosciuti' : field.label)),
    ]);
    expect(fixture.componentInstance.fieldRows.map((row) => row.map((field) => field.key))).toEqual(
      [
        ['rsnoAgresso', 'email', 'phone'],
        ['bornOn', 'education', 'careerStartedOn'],
        [],
        ['role', 'seniorityLevel', 'frameworks'],
        ['hiredOn', 'hiringLocation', 'residence'],
        ['notes'],
      ],
    );
    expect(details.querySelectorAll('hr')).toHaveLength(1);
    expect(details.children[2].tagName).toBe('HR');
    expect(details.querySelectorAll('dl')).toHaveLength(5);
    expect(element.querySelector('h1')?.textContent).toBe('Persona FITTIZIA');
    expect(element.querySelector('.person-title .badge')?.textContent?.trim()).toBe('Attiva');
    expect(details.textContent).not.toContain('Nome');
    expect(details.textContent).not.toContain('Cognome');
    expect(
      [...details.querySelectorAll('.framework-list li')].map((item) => item.textContent?.trim()),
    ).toEqual(['Java', 'Spring Boot']);
    expect(details.querySelector('.framework-list .devicon-java-plain')).not.toBeNull();
    expect(details.querySelector('.framework-list .devicon-spring-original')).not.toBeNull();
    for (const value of [
      'persona@example.test',
      'Recapito fittizio',
      'Java',
      'Spring Boot',
      '02/01/2020',
      'Sede fittizia',
      'Residenza fittizia',
      'Note fittizie\nSeconda riga',
      '6 anni',
      '02/01/2017',
      '9 anni e 10 mesi',
      'Senior',
      '00011',
      'Laurea magistrale',
    ]) {
      expect(details.textContent).toContain(value);
    }
    expect(details.textContent).not.toContain(person.id);
    expect(details.querySelector('[data-field]')?.getAttribute('data-field')).toBe('rsnoAgresso');
    expect(details.querySelector('[data-field="insideId"]')).toBeNull();
    expect(details.querySelector('[data-field="mypadId"]')).toBeNull();
    expect(details.textContent).not.toContain('Manager interno');
    expect(details.textContent).not.toContain('Manager esterno');
    const link = element.querySelector<HTMLAnchorElement>('.person-title a')!;
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

  it('displays age including zero and singular years, but no invented age for legacy people', async () => {
    const fixture = await create();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-field="bornOn"] dd')?.textContent).toContain('05/11/1990');
    expect(element.querySelector('[data-field="bornOn"] dd')?.textContent).toContain('(36 anni)');
    fixture.componentInstance.person.set({ ...person, age: 0 });
    await fixture.whenStable();
    expect(element.querySelector('[data-field="bornOn"] dd')?.textContent).toContain('(0 anni)');
    fixture.componentInstance.person.set({ ...person, age: 1 });
    await fixture.whenStable();
    expect(element.querySelector('[data-field="bornOn"] dd')?.textContent).toContain('(1 anno)');
    fixture.componentInstance.person.set({ ...person, bornOn: null, age: null });
    await fixture.whenStable();
    expect(element.querySelector('[data-field="bornOn"] dd')?.textContent).not.toContain('anni');
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
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.person-details')?.textContent,
    ).toContain('Ruolo aggiornato');
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
    expect(element.querySelector('.person-details')?.textContent).toContain('Archiviato');
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
