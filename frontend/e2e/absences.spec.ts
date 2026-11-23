import { test, expect } from '@playwright/test';

test('uploads fictitious CSV and XLSX and filters the monthly calendar', async ({ page }) => {
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  const csv = 'ResID;Abs. code\n001;F\n';
  let uploaded = false;
  let uploadedXlsx = false;
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
      if (request.headers()['content-type'] === 'text/csv') {
        expect(request.postData()).toBe(csv);
        uploaded = true;
      } else {
        expect(request.headers()['content-type']).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        expect(request.postDataBuffer()).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
        uploadedXlsx = true;
      }
      expect(request.headers()['x-csrf-token']).toBe('csrf-fittizio');
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
  await expect(page.getByRole('button', { name: 'Scegli file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importa file' })).toBeDisabled();
  await expect(page.getByText('Nessun file selezionato')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Scegli file' }).focus();
  await page.keyboard.press('Enter');
  await chooser;
  await expect(page.getByText('Ferie fittizie (F) · Approvata')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Fittizia Prima' }).check();
  await page.getByRole('checkbox', { name: 'Fittizia Seconda' }).check();
  await expect(page.getByText('Selezionate: 2.')).toBeVisible();
  await page.getByLabel('File CSV UTF-8 o XLSX (massimo 2 MiB)').setInputFiles({
    name: 'fittizio.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText('fittizio.csv')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importa file' })).toBeEnabled();
  await page.getByRole('button', { name: 'Importa file' }).click();
  await expect(page.getByText(/Importate: 1\. Invariate: 0\./)).toBeVisible();
  await expect(page.getByText('Record 3: Dati non validi.')).toBeVisible();
  expect(uploaded).toBe(true);
  await page.getByLabel('File CSV UTF-8 o XLSX (massimo 2 MiB)').setInputFiles({
    name: 'fittizio.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  });
  await page.getByRole('button', { name: 'Importa file' }).click();
  await expect.poll(() => uploadedXlsx).toBe(true);
  await page.getByRole('button', { name: 'Mese successivo' }).click();
  await expect(page.getByText('Ferie fittizie (F) · Approvata')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByLabel('File CSV UTF-8 o XLSX (massimo 2 MiB)').setInputFiles({
    name: `${'assenze-fittizie-'.repeat(12)}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  });
  const upload = page.locator('.upload');
  await expect
    .poll(() => upload.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Scegli file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importa file' })).toBeVisible();
});
