import { test, expect } from '@playwright/test';

test('uploads fictitious CSV and XLSX and filters the monthly calendar', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-10T12:00:00Z'));
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  const csv = 'ResID;Abs. code\n001;F\n';
  let uploaded = false;
  let uploadedXlsx = false;
  const closures: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1/', '');
    if (path === 'auth/me')
      return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
    if (path === 'auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
    if (path === 'notifications') return route.fulfill({ json: empty });
    if (path === 'company-closures' && request.method() === 'GET') {
      return route.fulfill({
        json: closures.filter((date) => date.startsWith(url.searchParams.get('month') ?? '')),
      });
    }
    if (path === 'company-closures' && request.method() === 'POST') {
      closures.push(request.postDataJSON().date);
      return route.fulfill({ status: 204 });
    }
    if (path === 'company-closures/cancel') {
      const index = closures.indexOf(request.postDataJSON().date);
      if (index >= 0) closures.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
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
    if (path === 'absences/capacity.xlsx') {
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename="assenze-capacity.xlsx"' },
        body: 'xlsx-fittizio',
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
  const nav = page.getByRole('navigation', { name: 'Navigazione principale' });
  await expect(nav.locator(':scope > a, :scope > button')).toHaveText([
    'Dashboard',
    'Task',
    'Persone',
    'Confronto RAL',
    'Assenze',
    'Import/Export',
  ]);
  const personeMenu = nav.getByRole('button', { name: 'Persone', exact: true });
  await personeMenu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Richieste Aumenti' })).toHaveAttribute(
    'href',
    '/raise-requests',
  );
  await expect(page.getByRole('menuitem', { name: 'Career talk' })).toHaveAttribute(
    'href',
    '/career-talks',
  );
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('button', { name: 'Assenze', exact: true })).toHaveClass(/selected/);
  await page.getByRole('button', { name: /Notifiche non lette/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Tutte le notifiche' })).toHaveAttribute(
    'href',
    '/notifications',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Scegli file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importa file' })).toBeDisabled();
  await expect(page.getByText('Nessun file selezionato')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Scegli file' }).focus();
  await page.keyboard.press('Enter');
  await chooser;
  await expect(page.getByText('Fittizia P. 8h')).toBeVisible();
  await expect(page.locator('[aria-label="2026-12-10"] .day-number')).toHaveClass(/today/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta Excel' }).click();
  expect((await download).suggestedFilename()).toBe('assenze-capacity.xlsx');
  await page.getByRole('button', { name: 'Fittizia Prima, dettagli assenza' }).click();
  await expect(page.getByText('Ferie fittizie (F) · Approvata')).toBeVisible();
  await expect(page.getByText('Giorni: 1 · Ore: 8 · Timesheet: Si')).toBeVisible();
  await page.keyboard.press('Escape');
  const currentMonth = (await page.locator('#calendar-title').innerText()).replace(
    'Calendario ',
    '',
  );
  const closureDate = `${currentMonth}-10`;
  await page.getByRole('button', { name: 'Assenze', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Chiusure Aziendali' }).click();
  await expect(page).toHaveURL(/\/company-closures$/);
  await page.getByLabel('Data di chiusura').fill('2027-01-15');
  await expect(page.getByRole('button', { name: 'Aggiungi chiusura' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Data non valida. Usa gg/mm/aaaa');
  await page.getByLabel('Data di chiusura').fill('31/02/2027');
  await expect(page.getByRole('button', { name: 'Aggiungi chiusura' })).toBeDisabled();
  await page.getByLabel('Data di chiusura').fill('01/01/9999');
  await expect(page.getByRole('button', { name: 'Aggiungi chiusura' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('31/12/9998');
  await page.getByLabel('Data di chiusura').fill('14/01/2027');
  await page.getByRole('button', { name: 'Apri calendario' }).click();
  await page.locator('mat-calendar').getByRole('button', { name: '15 gennaio 2027' }).click();
  await expect(page.getByRole('textbox', { name: 'Data di chiusura' })).toHaveValue('15/01/2027');
  await page.getByRole('button', { name: 'Aggiungi chiusura' }).click();
  await expect(page.getByLabel('Mese delle chiusure')).toHaveValue('2027-01');
  await expect(page.getByRole('button', { name: 'Annulla chiusura 2027-01-15' })).toBeVisible();
  await page.getByRole('button', { name: 'Mese precedente' }).click();
  await expect(page.getByLabel('Mese delle chiusure')).toHaveValue('2026-12');
  await expect(page.getByRole('button', { name: 'Annulla chiusura 2027-01-15' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mese successivo' }).click();
  await expect(page.getByLabel('Mese delle chiusure')).toHaveValue('2027-01');
  await expect(page.getByRole('button', { name: 'Annulla chiusura 2027-01-15' })).toBeVisible();
  await page.getByRole('button', { name: 'Annulla chiusura 2027-01-15' }).click();
  await page.getByLabel('Data di chiusura').fill(closureDate.split('-').reverse().join('/'));
  await page.getByRole('button', { name: 'Aggiungi chiusura' }).click();
  await expect(page.getByRole('button', { name: `Annulla chiusura ${closureDate}` })).toBeVisible();
  await page.getByRole('button', { name: 'Assenze', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Assenze', exact: true }).click();
  await expect(page.locator(`[aria-label="${closureDate}"] .day-number`)).toHaveClass(/closure/);
  await page.getByRole('button', { name: 'Assenze', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Chiusure Aziendali' }).click();
  await page.getByRole('button', { name: `Annulla chiusura ${closureDate}` }).click();
  await expect(page.getByRole('button', { name: `Annulla chiusura ${closureDate}` })).toHaveCount(
    0,
  );
  await page.getByLabel('Data di chiusura').fill('25/12/2026');
  await page.getByRole('button', { name: 'Aggiungi chiusura' }).click();
  await expect(page.getByRole('button', { name: 'Annulla chiusura 2026-12-25' })).toBeVisible();
  await page.getByRole('button', { name: 'Assenze', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Assenze', exact: true }).click();
  await expect(page.locator('[aria-label="2026-12-25"] .day-number')).toHaveClass(/holiday/);
  await expect(page.locator('[aria-label="2026-12-25"] .day-number')).not.toHaveClass(/closure/);
  await expect(page.locator('[aria-label="2026-12-25"] .day-number')).toHaveAttribute(
    'aria-label',
    /Natale.*Chiusura aziendale/,
  );
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
  await expect(page.getByText('Fittizia P. 8h')).toBeVisible();
  await page.getByRole('button', { name: 'Vai a oggi' }).click();
  await expect(page.locator('#calendar-title')).toHaveText('Calendario 2026-12');
  await expect(page.locator('[aria-label="2026-12-10"] .day-number')).toHaveClass(/today/);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
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
