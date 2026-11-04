import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Api, Page, Row } from '../core/api';
import { ResourcePage } from './resource-page';

describe('ResourcePage', () => {
  const empty: Page<Row> = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  const get = vi.fn();
  async function create() {
    get.mockReset().mockResolvedValue(empty);
    TestBed.configureTestingModule({
      imports: [ResourcePage],
      providers: [
        provideRouter([]),
        { provide: Api, useValue: { get, choices: vi.fn().mockResolvedValue([]) } },
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
  it('keeps only the sheet and archive actions in the people list with decorative icons', async () => {
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
    expect(row.querySelector('a')?.getAttribute('href')).toBe('/people/1');
    expect(row.textContent).toContain('Scheda');
    expect(row.textContent).toContain('Archivia');
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
    expect(row.textContent).toContain('Dettagli');
    expect(row.textContent).toContain('Modifica');
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
