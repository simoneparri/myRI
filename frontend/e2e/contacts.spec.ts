import { test, expect } from '@playwright/test';

test('contact dates, legacy editing and server-side chronological pagination with mocked API', async ({
  page,
}) => {
  const person = {
    id: '1',
    version: '0',
    firstName: 'Persona',
    lastName: 'Fittizia',
    hiredOn: '2020-01-01',
    status: 'active',
    frameworks: [],
  };
  const contacts = [
    {
      id: '2',
      version: '0',
      type: 'reference',
      value: 'Contatto recente',
      contactedOn: '2026-11-05',
    },
    {
      id: '1',
      version: '0',
      type: 'reference',
      value: 'Contatto passato',
      contactedOn: '2025-01-01',
    },
    { id: '3', version: '0', type: 'reference', value: 'Contatto legacy', contactedOn: null },
  ];
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  const unexpected: string[] = [];
  let created = false;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1/', '');
    if (path === 'auth/me')
      return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
    if (path === 'auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
    if (path === 'notifications') return route.fulfill({ json: empty });
    if (path === 'people')
      return route.fulfill({
        json: { ...empty, items: [person], totalElements: 1, totalPages: 1 },
      });
    if (path === 'people/1') return route.fulfill({ json: person });
    if (path === 'people/1/timeline') return route.fulfill({ json: empty });
    if (path === 'people/1/contacts') {
      if (request.method() === 'POST') {
        expect(request.postDataJSON()).toEqual(
          expect.objectContaining({ contactedOn: '2026-11-06' }),
        );
        created = true;
        return route.fulfill({ status: 201, json: { id: '4', ...request.postDataJSON() } });
      }
      expect(url.searchParams.get('sort')).toBe('contactedOn,desc');
      const current = Number(url.searchParams.get('page'));
      return route.fulfill({
        json: {
          ...empty,
          page: current,
          items: current === 0 ? contacts : [contacts[2]],
          totalElements: 21,
          totalPages: 2,
        },
      });
    }
    unexpected.push(`${request.method()} ${path}`);
    return route.abort();
  });
  await page.goto('/people/1');
  await page.getByRole('tab', { name: 'Contatti', exact: true }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByRole('columnheader', { name: 'Data di contatto' })).toBeVisible();
  const rows = panel.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('05/11/2026');
  await expect(rows.nth(1)).toContainText('01/01/2025');
  await expect(rows.nth(2)).toContainText('Contatto legacy');
  await rows.nth(2).getByRole('button', { name: 'Azioni', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Modifica', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Data di contatto', { exact: true })).toBeEmpty();
  await expect(dialog.getByRole('button', { name: 'Salva', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
  await panel.getByRole('button', { name: 'Nuovo contatto', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tipo', { exact: true }).fill('reference');
  await dialog.getByLabel('Recapito o riferimento', { exact: true }).fill('Fittizio');
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(created).toBe(false);
  await dialog.getByLabel('Data di contatto', { exact: true }).fill('06/11/2026');
  await dialog.getByLabel('Data di contatto', { exact: true }).press('Tab');
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(created).toBe(true);
  await panel.getByRole('button', { name: 'Pagina successiva', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Contatto legacy');
  expect(unexpected).toEqual([]);
});
