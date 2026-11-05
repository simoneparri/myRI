import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Api, Page, Row } from '../../core/api';
import { ResourcePage } from './resource-page';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Toast } from '../../shared/toast';

describe('ResourcePage', () => {
  const empty: Page<Row> = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  const get = vi.fn();
  const open = vi.fn();
  const success = vi.fn();
  const post = vi.fn();
  async function create() {
    open.mockReset().mockReturnValue({ afterClosed: () => of(false) });
    success.mockReset();
    post.mockReset().mockResolvedValue({});
    get.mockReset().mockResolvedValue(empty);
    TestBed.configureTestingModule({
      imports: [ResourcePage],
      providers: [
        provideRouter([]),
        { provide: Api, useValue: { get, post, choices: vi.fn().mockResolvedValue([]) } },
        { provide: MatDialog, useValue: { open } },
        { provide: Toast, useValue: { success } },
      ],
    });
    const fixture = TestBed.createComponent(ResourcePage);
    fixture.componentRef.setInput('resource', 'tasks');
    await fixture.whenStable();
    return fixture;
  }
  it('shows empty results and sends applied filters and server-side pagination', async () => {
    const fixture = await create();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nessun risultato');
    fixture.componentInstance.q = 'fittizio';
    fixture.componentInstance.personFilter = '9007199254740993';
    fixture.componentInstance.status = 'todo';
    await fixture.componentInstance.search();
    expect(get).toHaveBeenLastCalledWith(
      'tasks',
      expect.objectContaining({
        q: 'fittizio',
        personId: '9007199254740993',
        status: 'todo',
        page: 0,
      }),
    );
    fixture.componentInstance.paginate({ pageIndex: 1, pageSize: 10, length: 30 });
    expect(get).toHaveBeenLastCalledWith('tasks', expect.objectContaining({ page: 1, size: 10 }));
  });
  it('shows a server error instead of a success-shaped empty state', async () => {
    const fixture = await create();
    get.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    await fixture.componentInstance.reload();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role=alert]')?.textContent).toContain('Operazione non riuscita');
    expect(element.textContent).not.toContain('Nessun risultato');
  });
  it('formats raise percentages in points without changing salary formatting', async () => {
    const fixture = await create();
    get.mockResolvedValue({
      ...empty,
      items: [{ id: '1', requestedPercentage: '5.8', requestedSalary: '45000.50' }],
    });
    fixture.componentRef.setInput('resource', 'raise-requests');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('tbody')?.textContent).toContain('5,80%');
    expect(element.querySelector('tbody')?.textContent).toContain('45.000,50');
  });
  it('hides salary currency columns and filters while preserving contact filters', async () => {
    const fixture = await create();
    get.mockResolvedValue({
      ...empty,
      items: [{ id: '1', amount: '45000.50', currency: 'EUR' }],
    });
    fixture.componentRef.setInput('resource', 'salaries');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('Valuta');
    expect(element.textContent).not.toContain('EUR');
    expect(element.querySelector('input[name="category"]')).toBeNull();
    fixture.componentInstance.category = 'USD';
    await fixture.componentInstance.search();
    expect(get.mock.calls.at(-1)?.[1]).not.toHaveProperty('currency');
    fixture.componentRef.setInput('resource', 'contacts');
    fixture.componentRef.setInput('personId', '9');
    await fixture.whenStable();
    fixture.componentInstance.category = 'reference';
    await fixture.componentInstance.search();
    expect(get).toHaveBeenLastCalledWith(
      'people/9/contacts',
      expect.objectContaining({ type: 'reference' }),
    );
  });
  it('requests contacts by descending contact date on every server-side page and displays dates', async () => {
    const fixture = await create();
    get.mockResolvedValue({
      ...empty,
      totalElements: 3,
      items: [
        { id: '2', type: 'reference', value: 'Recent', contactedOn: '2026-11-05' },
        { id: '1', type: 'reference', value: 'Old', contactedOn: '2025-01-01' },
        { id: '3', type: 'reference', value: 'Legacy', contactedOn: null },
      ],
    });
    fixture.componentRef.setInput('resource', 'contacts');
    fixture.componentRef.setInput('personId', '9');
    await fixture.whenStable();
    expect(get).toHaveBeenLastCalledWith(
      'people/9/contacts',
      expect.objectContaining({ sort: 'contactedOn,desc', page: 0 }),
    );
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Data di contatto');
    expect(element.querySelector('tbody tr')?.textContent).toContain('05/11/2026');
    fixture.componentInstance.q = 'reference';
    await fixture.componentInstance.search();
    expect(get).toHaveBeenLastCalledWith(
      'people/9/contacts',
      expect.objectContaining({ sort: 'contactedOn,desc', q: 'reference' }),
    );
    fixture.componentInstance.paginate({ pageIndex: 1, pageSize: 2, length: 3 });
    expect(get).toHaveBeenLastCalledWith(
      'people/9/contacts',
      expect.objectContaining({ sort: 'contactedOn,desc', page: 1, size: 2 }),
    );
  });
  it('rejects invalid date filters instead of sending a normalized or malformed date', async () => {
    const fixture = await create();
    get.mockClear();
    fixture.componentInstance.from = '31/02/2026 10:00';
    await fixture.componentInstance.search();
    expect(get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toBe('Intervallo date non valido.');
    fixture.componentInstance.from = '2026-11-04T10:30';
    await fixture.componentInstance.search();
    expect(get).toHaveBeenCalledWith(
      'tasks',
      expect.objectContaining({ from: '2026-11-04T10:30:00.000Z' }),
    );
  });
  it('keeps only the sheet action in the people list with decorative icons', async () => {
    const fixture = await create();
    fixture.componentRef.setInput('resource', 'people');
    get.mockResolvedValue({
      ...empty,
      items: [{ id: '1', firstName: 'Persona', lastName: 'Fittizia', status: 'active' }],
      totalElements: 1,
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const row = element.querySelector('tbody tr')!;
    expect(row.querySelector('button[aria-label="Azioni"]')).toBeNull();
    expect(row.querySelector('a')?.textContent).toContain('Scheda');
    expect(fixture.componentInstance.actionsFor(fixture.componentInstance.page().items[0])).toEqual(
      [{ key: 'sheet', label: 'Scheda', icon: 'person', link: ['/people', '1'] }],
    );
    expect(row.textContent).not.toContain('Dettagli');
    expect(row.textContent).not.toContain('Modifica');
    for (const button of element.querySelectorAll('button:not(.mat-mdc-paginator button), a')) {
      expect(button.querySelector('svg[aria-hidden="true"] path')).not.toBeNull();
    }
  });
  it('preserves detail and edit actions for other resources', async () => {
    const fixture = await create();
    get.mockResolvedValue({
      ...empty,
      items: [{ id: '1', title: 'Task fittizio', status: 'todo' }],
      totalElements: 1,
    });
    await fixture.componentInstance.reload();
    await fixture.whenStable();
    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr')!;
    expect(row.querySelector('button[aria-label="Azioni"]')).not.toBeNull();
    expect(
      fixture.componentInstance
        .actionsFor(fixture.componentInstance.page().items[0])
        .map((action) => action.key),
    ).toEqual(['detail', 'edit', 'complete', 'cancel', 'archive']);
  });
  it('highlights current projects, displays past projects and sends period filters to the person endpoint', async () => {
    const fixture = await create();
    get.mockResolvedValue({
      ...empty,
      totalElements: 2,
      items: [
        { id: '1', client: 'Cliente attuale', status: 'current', workMode: 'hybrid' },
        { id: '2', client: 'Cliente passato', status: 'past', workMode: 'remote' },
      ],
    });
    fixture.componentRef.setInput('resource', 'projects');
    fixture.componentRef.setInput('personId', '9');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('tbody tr.current-project')).toHaveLength(1);
    expect(element.querySelector('tbody tr.current-project')?.textContent).toContain('Attivo ora');
    expect(element.textContent).toContain('Cliente passato');
    expect(element.textContent).toContain('Passato');
    expect(element.textContent).toContain('Ibrido');
    fixture.componentInstance.projectPeriod = 'past';
    await fixture.componentInstance.search();
    expect(get).toHaveBeenLastCalledWith(
      'people/9/projects',
      expect.objectContaining({ period: 'past' }),
    );
  });
  it('shows a toast only after a saved editor and not after cancellation', async () => {
    const fixture = await create();
    await fixture.componentInstance.edit();
    expect(success).not.toHaveBeenCalled();
    open.mockReturnValue({ afterClosed: () => of(true) });
    await fixture.componentInstance.edit();
    expect(success).toHaveBeenCalledExactlyOnceWith('Salvataggio completato.');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Dati salvati.');
  });
  it('uses toast confirmations for decisions and commands but not failed writes', async () => {
    const fixture = await create();
    open.mockReturnValue({ afterClosed: () => of(true) });
    await fixture.componentInstance.decision({ id: '1' }, 'approve');
    expect(success).toHaveBeenLastCalledWith('Esito registrato.');
    await fixture.componentInstance.command({ id: '1', version: '4' }, 'archive');
    expect(success).toHaveBeenLastCalledWith('Operazione completata.');
    success.mockClear();
    post.mockRejectedValue(new HttpErrorResponse({ status: 409 }));
    await fixture.componentInstance.command({ id: '1', version: '4' }, 'archive');
    expect(success).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('Conflitto');
  });
  it('uses calendar presets without sending hidden full-list filters', async () => {
    const fixture = await create();
    fixture.componentRef.setInput('view', 'today');
    await fixture.whenStable();
    expect(get).toHaveBeenLastCalledWith('todos', { view: 'today', page: 0, size: 20 });
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Includi archiviati');
    fixture.componentInstance.q = 'not sent';
    fixture.componentInstance.status = 'done';
    fixture.componentInstance.personFilter = '9007199254740993';
    fixture.componentInstance.todoView = 'next7';
    await fixture.componentInstance.search();
    expect(get).toHaveBeenLastCalledWith('todos', {
      view: 'next7',
      page: 0,
      size: 20,
      personId: '9007199254740993',
    });
    fixture.componentInstance.todoView = '';
    await fixture.componentInstance.search();
    expect(get).toHaveBeenLastCalledWith(
      'tasks',
      expect.objectContaining({ q: 'not sent', status: 'done' }),
    );
  });
});
