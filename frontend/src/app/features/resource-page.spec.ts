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
});
