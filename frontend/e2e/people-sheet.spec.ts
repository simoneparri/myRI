import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`people sheet, editing and local button icons at ${width}px with mocked API`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let person = {
      id: '9007199254740993',
      version: '4',
      firstName: 'Persona',
      lastName: 'Fittizia',
      email: 'persona@example.test',
      phone: 'Recapito fittizio',
      role: 'Ruolo fittizio',
      hiredOn: '2020-01-02',
      hiringLocation: 'Sede fittizia',
      residence: 'Residenza fittizia',
      managerId: null,
      externalManager: 'Manager fittizio',
      notes: 'Note fittizie',
      status: 'active',
      seniority: '6 anni',
      careerStartedOn: '2017-01-02',
      careerDuration: '9 anni e 10 mesi',
      seniorityLevel: 'medior',
      mypadId: 'fictitious-123',
    };
    const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    const unexpected: string[] = [];
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1/', '');
      if (path === 'auth/me')
        return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
      if (path === 'auth/csrf')
        return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
      if (path === 'people')
        return route.fulfill({
          json: { ...empty, items: [person], totalElements: 1, totalPages: 1 },
        });
      if (path === `people/${person.id}`) {
        if (request.method() === 'PUT') {
          expect(request.postDataJSON().version).toBe('4');
          person = { ...person, ...request.postDataJSON(), version: '5' };
        }

        return route.fulfill({ json: person });
      }
      if (path === `people/${person.id}/timeline`) return route.fulfill({ json: empty });
      unexpected.push(`${request.method()} ${path}`);
      return route.abort();
    });

    await page.goto('/people');
    const personRow = page.getByRole('row').filter({ hasText: 'persona@example.test' });
    await expect(personRow.getByRole('button', { name: 'Dettagli', exact: true })).toHaveCount(0);
    await expect(personRow.getByRole('button', { name: 'Modifica', exact: true })).toHaveCount(0);
    await personRow.getByRole('link', { name: 'Scheda', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Persona Fittizia', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Orari visualizzati in Europe/Rome.')).toHaveCount(0);
    await expect(page.getByText(/Export completo della persona/)).toHaveCount(0);
    expect(
      await page
        .getByRole('button', { name: 'Esporta JSON', exact: true })
        .evaluate(
          (button) =>
            !!(
              document.querySelector('mat-tab-group')!.compareDocumentPosition(button) &
              Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
    ).toBe(true);
    for (const value of [
      'Recapito fittizio',
      'Sede fittizia',
      'Residenza fittizia',
      'Note fittizie',
    ]) {
      await expect(page.getByRole('definition').filter({ hasText: value })).toBeVisible();
    }
    const edit = page.getByRole('button', { name: 'Modifica', exact: true });
    const icon = edit.locator('svg[aria-hidden="true"]');
    await expect(icon).toBeVisible();
    expect(await icon.evaluate((svg) => svg.namespaceURI)).toBe('http://www.w3.org/2000/svg');
    expect(await icon.locator('path').getAttribute('d')).toBeTruthy();
    await expect(page.getByRole('link', { name: 'Apri MyPad (nuova scheda)' })).toHaveAttribute(
      'href',
      'https://mypad.altengroup.com/employees/fictitious-123',
    );
    await edit.click();
    const dialog = page.getByRole('dialog');
    const hiredOn = dialog.getByLabel('Data di assunzione', { exact: true });
    await expect(hiredOn).toHaveValue('02/01/2020');
    await hiredOn.fill('31/02/2020');
    await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('Data non valida');
    await hiredOn.fill('02/01/2020');
    await dialog
      .locator('app-date-input')
      .filter({ hasText: 'Data di assunzione' })
      .getByRole('button', { name: 'Apri calendario', exact: true })
      .click();
    await expect(page.locator('mat-calendar')).toBeVisible();
    await page
      .locator('mat-calendar')
      .getByRole('button', { name: '3 gennaio 2020', exact: true })
      .click();
    await expect(hiredOn).toHaveValue('03/01/2020');
    await expect(dialog.getByLabel('Data di inizio lavoro', { exact: true })).toHaveValue(
      '02/01/2017',
    );
    await dialog.getByLabel('Ruolo', { exact: true }).fill('Ruolo aggiornato');
    await dialog.getByLabel('Note', { exact: true }).fill('Note aggiornate');
    await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const toast = page.locator('mat-snack-bar-container');
    await expect(toast).toContainText('Salvataggio completato.');
    await expect(page.locator('main')).not.toContainText('Salvataggio completato.');
    await toast.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(toast).not.toBeVisible();
    await expect(
      page.getByRole('definition').filter({ hasText: 'Ruolo aggiornato' }),
    ).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: 'Note aggiornate' })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: '03/01/2020' })).toBeVisible();
    await page.getByRole('link', { name: 'Torna alle persone', exact: true }).click();
    await expect(personRow).toContainText('Ruolo aggiornato');
    expect(unexpected).toEqual([]);
  });
}

test('new census requires MyPad ID and saves distinct career dates and manual seniority', async ({
  page,
}) => {
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  let saved: Record<string, unknown> | null = null;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    if (path === 'auth/me')
      return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
    if (path === 'auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
    if (path === 'people' && request.method() === 'POST') {
      saved = {
        ...request.postDataJSON(),
        id: '9007199254740993',
        version: '0',
        seniority: '6 anni e 10 mesi',
        careerDuration: '9 anni e 10 mesi',
      };
      return route.fulfill({ status: 201, json: saved });
    }
    if (path === 'people')
      return route.fulfill({
        json: {
          ...empty,
          items: saved ? [saved] : [],
          totalElements: saved ? 1 : 0,
          totalPages: saved ? 1 : 0,
        },
      });
    if (path === 'people/9007199254740993') return route.fulfill({ json: saved });
    return route.fulfill({ json: empty });
  });
  await page.goto('/people');
  await page.getByRole('button', { name: 'Nuova persona', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill('Persona');
  await dialog.getByLabel('Cognome', { exact: true }).fill('Fittizia');
  await dialog.getByLabel('Data di assunzione', { exact: true }).fill('02/01/2020');
  await dialog.getByLabel('Data di inizio lavoro', { exact: true }).fill('02/01/2017');
  await dialog.getByLabel('Livello di seniority', { exact: true }).click();
  await page.getByRole('option', { name: 'Senior', exact: true }).click();
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(saved).toBeNull();
  await dialog.getByLabel('MyPad ID', { exact: true }).fill('fictitious-123');
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(saved).toEqual(
    expect.objectContaining({
      mypadId: 'fictitious-123',
      hiredOn: '2020-01-02',
      careerStartedOn: '2017-01-02',
      seniorityLevel: 'senior',
    }),
  );
  await page.getByRole('link', { name: 'Scheda', exact: true }).click();
  await expect(page.getByRole('definition').filter({ hasText: '02/01/2020' })).toContainText(
    '(6 anni e 10 mesi)',
  );
  await expect(page.getByRole('definition').filter({ hasText: '02/01/2017' })).toContainText(
    '(9 anni e 10 mesi)',
  );
  await expect(page.getByRole('definition').filter({ hasText: 'Senior' })).toBeVisible();
  const link = page.getByRole('link', { name: 'Apri MyPad (nuova scheda)' });
  await expect(link).toHaveAttribute(
    'href',
    'https://mypad.altengroup.com/employees/fictitious-123',
  );
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('date/time filters and editor preserve UTC when typing or choosing a date', async ({
  page,
}) => {
  const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  let filteredFrom: string | null = null;
  let savedDueAt: string | null = null;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1/', '');
    if (path === 'auth/me')
      return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
    if (path === 'auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
    if (path === 'tasks') {
      if (request.method() === 'POST') {
        savedDueAt = request.postDataJSON().dueAt;
        return route.fulfill({ json: { id: '1', ...request.postDataJSON() } });
      }
      filteredFrom = url.searchParams.get('from');
    }
    return route.fulfill({ json: empty });
  });
  await page.goto('/tasks');
  const from = page.getByLabel('Dal (UTC)', { exact: true });
  await from.fill('04/11/2026 23:30');
  await page.getByRole('button', { name: 'Applica filtri', exact: true }).click();
  await expect.poll(() => filteredFrom).toBe('2026-11-04T23:30:00.000Z');
  await page.getByRole('button', { name: 'Nuovo task', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titolo', { exact: true }).fill('Task fittizio');
  const dueAt = dialog.getByLabel('Scadenza (UTC)', { exact: true });
  await dueAt.fill('04/11/2026 23:30');
  await dialog.getByRole('button', { name: 'Apri calendario', exact: true }).click();
  await page
    .locator('mat-calendar')
    .getByRole('button', { name: '5 novembre 2026', exact: true })
    .click();
  await expect(dueAt).toHaveValue('05/11/2026 23:30');
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(savedDueAt).toBe('2026-11-05T23:30:00.000Z');
});
