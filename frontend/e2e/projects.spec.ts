import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`project tab creates, edits and distinguishes active and past projects at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const person = {
      id: '1', version: '0', firstName: 'Persona', lastName: 'Fittizia',
      hiredOn: '2020-01-01', status: 'active', frameworks: [],
    };
    const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    let rows = [
      { id: '1', version: '0', personId: '1', client: 'Cliente corrente', startsOn: null,
        endsOn: null, businessManager: 'BM fittizio', workMode: 'hybrid', notes: '', status: 'current', archivedAt: null },
      { id: '2', version: '0', personId: '1', client: 'Cliente precedente', startsOn: '2020-01-01',
        endsOn: '2020-12-31', businessManager: 'BM fittizio', workMode: 'remote', notes: '', status: 'past', archivedAt: null },
    ];
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace('/api/v1/', '');
      if (path === 'auth/me') return route.fulfill({ json: { id: '1', username: 'fittizio' } });
      if (path === 'auth/csrf') return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'fittizio' } });
      if (path === 'people/1') return route.fulfill({ json: person });
      if (path === 'people') return route.fulfill({ json: { ...empty, items: [person], totalElements: 1, totalPages: 1 } });
      if (path === 'people/1/projects') {
        if (request.method() === 'POST') {
          expect(request.postDataJSON().startsOn).toBeNull();
          expect(request.postDataJSON().endsOn).toBeNull();
          const created = { ...request.postDataJSON(), id: '3', version: '0', personId: '1', status: 'current', archivedAt: null };
          rows.push(created);
          return route.fulfill({ status: 201, json: created });
        }
        const period = url.searchParams.get('period');
        const selected = rows.filter((row) => !period || row.status === period);
        return route.fulfill({ json: { ...empty, items: selected, totalElements: selected.length, totalPages: 1 } });
      }
      if (path === 'projects/3' && request.method() === 'PUT') {
        expect(request.postDataJSON().version).toBe('0');
        rows = rows.map((row) => row.id === '3' ? { ...row, ...request.postDataJSON(), version: '1' } : row);
        return route.fulfill({ json: rows.find((row) => row.id === '3') });
      }
      return route.fulfill({ json: empty });
    });
    await page.goto('/people/1');
    await expect(page.getByText('Manager interno', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Manager esterno (alternativo)', { exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Progetti', exact: true }).click();
    await expect(page.locator('tr.current-project')).toContainText('Cliente corrente');
    await expect(page.getByRole('row').filter({ hasText: 'Cliente precedente' })).toContainText('Passato');
    await page.getByRole('button', { name: 'Nuovo progetto', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Cliente', { exact: true }).fill('Nuovo cliente fittizio');
    await dialog.getByLabel('BM di riferimento', { exact: true }).fill('BM progetto');
    await dialog.getByLabel('Note', { exact: true }).fill('Note progetto');
    await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const row = page.getByRole('row').filter({ hasText: 'Nuovo cliente fittizio' });
    await expect(row).toHaveClass(/current-project/);
    await row.getByRole('button', { name: 'Azioni', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Modifica', exact: true }).click();
    await dialog.getByLabel('Cliente', { exact: true }).fill('Cliente aggiornato');
    await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Cliente aggiornato' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Periodo', exact: true }).click();
    await page.getByRole('option', { name: 'Passati', exact: true }).click();
    await page.getByRole('button', { name: 'Applica filtri', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Cliente precedente');
  });
}
