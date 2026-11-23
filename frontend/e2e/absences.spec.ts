import { test, expect } from '@playwright/test';

test('imports fictitious CSV and filters the monthly calendar', async ({ page }) => {
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  const csv = 'ResID;Abs. code\n001;F\n';
  let uploaded = false;
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
        json: {
          ...empty,
          items: [
            { id: '9007199254740993', firstName: 'Prima', lastName: 'Fittizia' },
            { id: '9007199254740994', firstName: 'Seconda', lastName: 'Fittizia' },
          ],
          totalElements: 2,
          totalPages: 1,
        },
      });
    if (path === 'absences/import') {
      expect(request.postData()).toBe(csv);
      expect(request.headers()['x-csrf-token']).toBe('csrf-fittizio');
      uploaded = true;
      return route.fulfill({
        json: {
          imported: 1,
          unchanged: 0,
          skipped: 1,
          replaced: 1,
          errors: [{ row: 3, reason: 'Dati non validi.' }],
        },
      });
    }
    if (path === 'absences') {
      const month = url.searchParams.get('month');
      const selected = url.searchParams.get('personIds');
      return route.fulfill({
        json:
          month && (!selected || selected.includes('9007199254740993'))
            ? [
                {
                  id: '1',
                  personId: '9007199254740993',
                  firstName: 'Prima',
                  lastName: 'Fittizia',
                  startsAt: `${month}-10T09:00:00`,
                  endsAt: `${month}-10T17:00:00`,
                  code: 'F',
                  label: 'Ferie fittizie',
                  status: 'Approvata',
                  days: '1',
                  hours: '8',
                  importedToTimesheet: 'Si',
                },
              ]
            : [],
      });
    }
    throw new Error(`Unexpected API request: ${path}`);
  });
  await page.goto('/absences');
  await expect(page.getByText('Ferie fittizie (F) · Approvata')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Fittizia Prima' }).check();
  await page.getByRole('checkbox', { name: 'Fittizia Seconda' }).check();
  await expect(page.getByText('Selezionate: 2.')).toBeVisible();
  await page.getByLabel('File CSV UTF-8 (massimo 2 MiB)').setInputFiles({
    name: 'fittizio.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Importa CSV' }).click();
  await expect(page.getByText(/Importate: 1\. Invariate: 0\./)).toBeVisible();
  await expect(page.getByText('Record 3: Dati non validi.')).toBeVisible();
  expect(uploaded).toBe(true);
  await page.getByRole('button', { name: 'Mese successivo' }).click();
  await expect(page.getByText('Ferie fittizie (F) · Approvata')).toBeVisible();
});
