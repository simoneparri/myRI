import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Api } from '../../core/api';
import { ImportExport } from './import-export';

describe('ImportExport', () => {
  const first = { id: '9007199254740993', firstName: 'Persona', lastName: 'Fittizia' };
  const page = { items: [first], page: 0, size: 20, totalElements: 21, totalPages: 2 };

  function setup() {
    const api = {
      get: vi.fn().mockResolvedValue(page),
      download: vi.fn().mockResolvedValue(new Blob(['{}'])),
      postJson: vi.fn().mockResolvedValue({
        imported: 1,
        skipped: 1,
        results: [
          { sourceId: '1', personId: '3', status: 'imported', reason: null },
          { sourceId: '2', personId: null, status: 'skipped', reason: 'rsno_agresso' },
        ],
      }),
    };
    TestBed.configureTestingModule({
      imports: [ImportExport],
      providers: [{ provide: Api, useValue: api }],
    });
    const fixture = TestBed.createComponent(ImportExport);
    return { fixture, component: fixture.componentInstance, api };
  }

  function choose(component: ImportExport, text: string) {
    const file = new File([text], 'fittizio.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => text });
    component.chooseFile({ target: { files: [file] } } as unknown as Event);
  }

  it('keeps selection across pages, filters archives and exports IDs as strings', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    component.toggle(first.id, true);
    component.paginate({ pageIndex: 1, pageSize: 20, length: 21 });
    await fixture.whenStable();
    expect(component.selected().has(first.id)).toBe(true);
    expect(component.selectablePeople()).toContainEqual({
      id: first.id,
      label: 'Fittizia Persona',
    });
    component.includeArchived = true;
    component.q = 'Fittizia';
    component.search();
    await fixture.whenStable();
    expect(api.get).toHaveBeenLastCalledWith('people', {
      q: 'Fittizia',
      includeArchived: true,
      page: 0,
      size: 20,
      sort: 'lastName,asc',
    });
    const create = vi.fn().mockReturnValue('blob:fittizio');
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    try {
      await component.exportFile();
      expect(api.download).toHaveBeenCalledWith('transfers/export', { personIds: [first.id] });
      expect(click).toHaveBeenCalled();
      component.clearSelection();
      expect(component.selectedCount()).toBe(0);
      await new Promise((resolve) => setTimeout(resolve, 1100));
    } finally {
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('searches inside the multiselect and retains selected people', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    component.updateSelection([first.id]);
    component.searchPeople('persona');
    await new Promise((resolve) => setTimeout(resolve, 275));
    await fixture.whenStable();

    expect(api.get).toHaveBeenLastCalledWith('people', {
      q: 'persona',
      includeArchived: false,
      page: 0,
      size: 20,
      sort: 'lastName,asc',
    });
    expect(component.selectedIds()).toEqual([first.id]);
    expect(component.selectablePeople()).toContainEqual({
      id: first.id,
      label: 'Fittizia Persona',
    });
    expect(fixture.nativeElement.querySelector('mat-select')).not.toBeNull();
  });

  it('selects all matching export results up to the 100-person limit', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    const people = Array.from({ length: 100 }, (_, index) => ({
      id: String(index + 1),
      firstName: 'Persona',
      lastName: `Cognome${index + 1}`,
    }));
    component.q = 'Cognome';
    component.includeArchived = true;
    component.updateSelection([first.id]);
    api.get.mockResolvedValueOnce({
      items: people,
      page: 0,
      size: 100,
      totalElements: 130,
      totalPages: 2,
    });

    await component.selectAll();
    fixture.detectChanges();

    expect(api.get).toHaveBeenLastCalledWith('people', {
      q: 'Cognome',
      includeArchived: true,
      page: 0,
      size: 100,
      sort: 'lastName,asc',
    });
    expect(component.selectedCount()).toBe(100);
    expect(component.selected().has(first.id)).toBe(false);
    expect(component.selectionMessage()).toContain('prime 100 persone');
    expect(component.selectablePeople()).toContainEqual({
      id: '1',
      label: 'Cognome1 Persona',
    });
    expect(fixture.nativeElement.textContent).toContain('Seleziona tutti i risultati (max 100)');
  });

  it('hides the page-size control while keeping pagination', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-paginator')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.mat-mdc-paginator-page-size')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mat-mdc-paginator-range-label')).not.toBeNull();
  });

  it('requires confirmation, sends the original JSON and displays imported/skipped results', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    const text = '{"amount":"9999999999.99","id":"9007199254740993"}';
    choose(component, text);
    await component.importFile();
    expect(api.postJson).not.toHaveBeenCalled();
    component.consent.set(true);
    await component.importFile();
    await fixture.whenStable();
    expect(api.postJson).toHaveBeenCalledWith('transfers/import', text);
    expect(fixture.nativeElement.textContent).toContain('Importate: 1. Saltate: 1.');
    expect(fixture.nativeElement.textContent).toContain('rsno_agresso');
    expect(component.consent()).toBe(false);
  });

  it('displays the selected filename and disables the chooser during an operation', async () => {
    const { fixture, component } = setup();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('.upload-actions button')!;
    const input = element.querySelector<HTMLInputElement>('#transfer-file')!;
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    expect(element.textContent).toContain('Nessun file selezionato');
    button.click();
    expect(click).toHaveBeenCalledOnce();
    choose(component, '{}');
    fixture.detectChanges();
    expect(element.querySelector('#transfer-file-name')?.textContent).toContain('fittizio.json');
    component.busy.set(true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(input.disabled).toBe(true);
  });

  it('shows server errors without a success report and enforces size and selection limits', async () => {
    const { fixture, component, api } = setup();
    await fixture.whenStable();
    choose(component, '{}');
    component.consent.set(true);
    api.postJson.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { detail: 'File non compatibile.' },
      }),
    );
    await component.importFile();
    await fixture.whenStable();
    expect(component.report()).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'File non compatibile.',
    );
    component.chooseFile({
      target: { files: [{ size: 10 * 1024 * 1024 + 1 }], value: 'file' },
    } as unknown as Event);
    expect(component.file()).toBeNull();
    for (let i = 1; i <= 101; i++) component.toggle(String(i), true);
    expect(component.selectedCount()).toBe(100);
    expect(component.error()).toContain('100 persone');
  });
});
