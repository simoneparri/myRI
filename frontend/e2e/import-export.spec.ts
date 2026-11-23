import { test, expect } from '@playwright/test';

test('transfers multiple selected people and reports duplicates using only a mocked fictitious API', async ({
  page,
}) => {
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  const unexpected: string[] = [];
  const raw =
    '{"format":"myri-transfer","schemaVersion":1,"id":"9007199254740993","amount":"9999999999.99"}';
  let imported = false;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1/', '');
    if (path === 'auth/me')
      return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
    if (path === 'auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
    if (path === 'notifications') return route.fulfill({ json: empty });
    if (path === 'people') {
      const current = Number(url.searchParams.get('page'));
      return route.fulfill({
        json: {
          ...empty,
          page: current,
          totalElements: 21,
          totalPages: 2,
          items:
            current === 0
              ? [{ id: '9007199254740993', firstName: 'Prima', lastName: 'Fittizia' }]
              : [
                  {
                    id: '9007199254740994',
                    firstName: 'Seconda',
                    lastName: 'Fittizia',
                    archivedAt: '2026-01-01',
                  },
                ],
        },
      });
    }
    if (path === 'transfers/export') {
      expect(request.method()).toBe('POST');
      expect(request.postDataJSON()).toEqual({
        personIds: ['9007199254740993', '9007199254740994'],
      });
      expect(request.headers()['x-csrf-token']).toBe('csrf-fittizio');
      return route.fulfill({
        contentType: 'application/json',
        headers: { 'Content-Disposition': 'attachment; filename="myri-transfer.json"' },
        body: raw,
      });
    }
    if (path === 'transfers/import') {
      expect(request.postData()).toBe(raw);
      expect(request.headers()['x-csrf-token']).toBe('csrf-fittizio');
      imported = true;
      return route.fulfill({
        json: {
          imported: 1,
          skipped: 1,
          results: [
            { sourceId: '9007199254740993', personId: '3', status: 'imported', reason: null },
            { sourceId: '9007199254740994', personId: null, status: 'skipped', reason: 'mypad_id' },
          ],
        },
      });
    }
    unexpected.push(`${request.method()} ${path}`);
    return route.abort();
  });
  await page.goto('/import-export');
  await page.getByRole('checkbox', { name: 'Fittizia Prima', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Includi persone archiviate' }).check();
  await page.getByRole('button', { name: 'Cerca', exact: true }).click();
  await page.getByRole('button', { name: 'Pagina successiva', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Fittizia Seconda (archiviata)' }).check();
  await expect(page.getByText('2 persone selezionate, anche su altre pagine')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta JSON', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('myri-transfer.json');
  await expect(page.getByText('Nessun file selezionato')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Scegli file' }).focus();
  await page.keyboard.press('Enter');
  await chooser;
  await page.getByLabel('File JSON myRI (massimo 10 MiB)').setInputFiles({
    name: 'fittizio.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect(page.getByText('fittizio.json')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importa JSON', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Confermo di voler importare' }).check();
  await page.getByRole('button', { name: 'Importa JSON', exact: true }).click();
  await expect(page.getByText('Importate: 1. Saltate: 1.')).toBeVisible();
  await expect(
    page.getByText(/saltata per identificativo gia presente \(mypad_id\)/),
  ).toBeVisible();
  expect(imported).toBe(true);
  expect(unexpected).toEqual([]);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByLabel('File JSON myRI (massimo 10 MiB)').setInputFiles({
    name: `${'trasferimento-fittizio-'.repeat(10)}.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect
    .poll(() => page.locator('.upload').evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Scegli file' })).toBeVisible();
});
