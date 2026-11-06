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
      frameworks: ['Java', 'Spring Boot', 'Angular'],
      hiredOn: '2020-01-02',
      bornOn: '1990-11-05',
      hiringLocation: 'Sede fittizia',
      residence: 'Residenza fittizia',
      managerId: null,
      externalManager: 'Manager fittizio',
      notes: 'Note fittizie',
      status: 'active',
      seniority: '6 anni',
      careerStartedOn: '2017-01-02',
      careerDuration: '9 anni e 10 mesi',
      age: 36,
      seniorityLevel: 'medior',
      mypadId: 'fictitious-123',
    };
    const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    const unexpected: string[] = [];
    let phoneUpdates = 0;
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1/', '');
      if (path === 'auth/me')
        return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
      if (path === 'auth/csrf')
        return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
      if (path === 'notifications') return route.fulfill({ json: empty });
      if (path === 'people')
        return route.fulfill({
          json: { ...empty, items: [person], totalElements: 1, totalPages: 1 },
        });
      if (path === `people/${person.id}`) {
        if (request.method() === 'PUT') {
          const body = request.postDataJSON();
          expect(body.version).toBe(person.version);
          expect(body.phone).toBe(phoneUpdates === 0 ? 'Recapito fittizio' : '+390212345678');
          expect(body.frameworks).toEqual(['Java', 'Spring Boot', 'Angular', 'React']);
          phoneUpdates++;
          person = {
            ...person,
            ...body,
            version: String(Number(person.version) + 1),
          };
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
    const deviconStylesheet = page.waitForResponse((response) =>
      response.url().endsWith('/assets/devicon/devicon.min.css'),
    );
    await personRow.getByRole('link', { name: 'Scheda', exact: true }).click();
    expect((await deviconStylesheet).ok()).toBe(true);
    await expect(
      page.getByRole('heading', { name: 'Persona FITTIZIA', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.person-details dt', { hasText: /^Nome$/ })).toHaveCount(0);
    await expect(page.locator('.person-details dt', { hasText: /^Cognome$/ })).toHaveCount(0);
    await expect(page.locator('.person-title .status-dot')).toHaveAttribute('aria-label', 'Attiva');
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
    const frameworks = page.locator('[data-field="frameworks"]');
    await expect(frameworks.locator('li')).toHaveText(['Java', 'Spring Boot', 'Angular']);
    await expect(frameworks.locator('li .devicon-java-plain')).toBeVisible();
    await expect(frameworks.locator('li .devicon-spring-original')).toBeVisible();
    await expect(frameworks.locator('li .devicon-angular-plain')).toBeVisible();
    await expect
      .poll(() =>
        frameworks
          .locator('li .devicon-java-plain')
          .evaluate((icon) => getComputedStyle(icon).fontFamily),
      )
      .toContain('devicon');
    await expect
      .poll(() =>
        frameworks
          .locator('li .devicon-angular-plain')
          .evaluate((icon) => getComputedStyle(icon).color),
      )
      .toBe('rgb(0, 0, 0)');
    expect(
      await frameworks
        .locator('li .devicon-java-plain')
        .evaluate((icon) => getComputedStyle(icon).color),
    ).not.toBe('rgb(0, 0, 0)');
    if (width > 800) {
      for (const fields of [
        ['rsnoAgresso', 'email', 'phone'],
        ['bornOn', 'education', 'careerStartedOn'],
        ['role', 'seniorityLevel', 'frameworks'],
        ['hiredOn', 'hiringLocation', 'residence'],
      ]) {
        const positions = await Promise.all(
          fields.map((field) =>
            page
              .locator(`[data-field="${field}"]`)
              .evaluate((item) => item.getBoundingClientRect().top),
          ),
        );
        expect(new Set(positions).size).toBe(1);
        const leftPositions = await Promise.all(
          fields.map((field) =>
            page
              .locator(`[data-field="${field}"]`)
              .evaluate((item) => item.getBoundingClientRect().left),
          ),
        );
        expect(leftPositions).toEqual([...leftPositions].sort((a, b) => a - b));
      }
      await expect(page.locator('.detail-row').nth(1).locator('[data-field]')).toHaveCount(3);
      expect(
        await page
          .locator('.detail-row')
          .nth(1)
          .locator('[data-field]')
          .evaluateAll((fields) => fields.map((field) => field.getAttribute('data-field'))),
      ).toEqual(['bornOn', 'education', 'careerStartedOn']);
    }
    const separator = page.locator('.person-details > hr');
    await expect(separator).toHaveCount(2);
    await expect(separator.first()).toBeVisible();
    expect(
      await separator.first().evaluate((line) => line.getBoundingClientRect().width),
    ).toBeGreaterThan(200);
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
    const frameworkSelect = dialog.getByRole('combobox', {
      name: 'Framework conosciuti',
      exact: true,
    });
    await frameworkSelect.click();
    const frameworkSearch = dialog.getByLabel('Cerca framework', { exact: true });
    expect(
      await frameworkSearch.evaluate((input) => Boolean(input.closest('.framework-select-panel'))),
    ).toBe(true);
    await frameworkSearch.fill('react');
    await expect(page.getByRole('option', { name: 'React', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Docker', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'React', exact: true }).click();
    await frameworkSelect.press('Escape');
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
    await expect(page.locator('[data-field="frameworks"] li')).toHaveText([
      'Java',
      'Spring Boot',
      'Angular',
      'React',
    ]);
    await expect(page.getByRole('definition').filter({ hasText: 'Note aggiornate' })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: '03/01/2020' })).toBeVisible();
    await page.getByRole('link', { name: 'Torna alle persone', exact: true }).click();
    await expect(personRow).toContainText('Ruolo aggiornato');
    await personRow.getByRole('link', { name: 'Scheda', exact: true }).click();
    await page.getByRole('button', { name: 'Modifica', exact: true }).click();
    const phoneEditor = page.getByRole('dialog');
    await expect(phoneEditor.getByText(/Il numero esistente non e valido/)).toBeVisible();
    await phoneEditor.getByLabel('Telefono', { exact: true }).fill('02 12345678');
    await phoneEditor.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(phoneEditor).not.toBeVisible();
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
        age: 36,
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
  const birthDate = dialog.getByLabel('Data di nascita', { exact: true });
  await expect(birthDate).toBeEmpty();
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  expect(saved).toBeNull();
  await birthDate.fill('05/11/1990');
  await dialog.getByLabel('RSNO Agresso', { exact: true }).fill('00011');
  await dialog.getByLabel('Inside ID', { exact: true }).fill('00012');
  await dialog.getByLabel('Educazione', { exact: true }).click();
  await page.getByRole('option', { name: 'Laurea magistrale', exact: true }).click();
  const phone = dialog.getByLabel('Telefono', { exact: true });
  const countrySelector = dialog.locator('.iti__selected-country');
  await expect(countrySelector).toHaveAttribute('aria-label', /Italia|Italy/);
  await countrySelector.click();
  const unitedStates = page.locator('.iti__country-list [data-iso2="us"]');
  await expect(unitedStates).toBeVisible();
  await unitedStates.click();
  await phone.fill('123');
  await dialog.getByLabel('Data di assunzione', { exact: true }).fill('02/01/2020');
  await dialog.getByLabel('Data di inizio lavoro', { exact: true }).fill('02/01/2017');
  await dialog.getByLabel('Livello di seniority', { exact: true }).click();
  await page.getByRole('option', { name: 'Senior', exact: true }).click();
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(saved).toBeNull();
  await dialog.getByLabel('MyPad ID', { exact: true }).fill('fictitious-123');
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('numero di telefono valido');
  expect(saved).toBeNull();
  await phone.fill('2025550123');
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(saved).toEqual(
    expect.objectContaining({
      mypadId: 'fictitious-123',
      bornOn: '1990-11-05',
      rsnoAgresso: '00011',
      insideId: '00012',
      education: 'master',
      phone: '+12025550123',
      hiredOn: '2020-01-02',
      careerStartedOn: '2017-01-02',
      seniorityLevel: 'senior',
    }),
  );
  await page
    .getByRole('row')
    .filter({ hasText: 'Persona' })
    .getByRole('link', { name: 'Scheda', exact: true })
    .click();
  await expect(page.locator('[data-field="bornOn"] dd')).toContainText('05/11/1990');
  await expect(page.locator('[data-field="bornOn"] dd')).toContainText('(36 anni)');
  await expect(page.locator('[data-field="rsnoAgresso"] dd')).toHaveText('00011');
  await expect(page.locator('[data-field="insideId"]')).toHaveCount(0);
  await expect(page.locator('[data-field="mypadId"]')).toHaveCount(0);
  await expect(page.locator('[data-field="education"] dd')).toHaveText('Laurea magistrale');
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

test('raise editor calculates upward-rounded percentage and keeps manual percentage without target', async ({
  page,
}) => {
  const person = {
    id: '9',
    version: '1',
    firstName: 'Persona',
    lastName: 'Fittizia',
    status: 'active',
  };
  const salary = {
    id: '11',
    amount: '45000.00',
    currency: 'EUR',
    effectiveOn: '2026-01-01',
  };
  const requests: Record<string, unknown>[] = [];
  const makePage = (items: unknown[]) => ({
    items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    if (path === 'auth/me')
      return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
    if (path === 'auth/csrf')
      return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
    if (path === 'people') return route.fulfill({ json: makePage([person]) });
    if (path === 'people/9/salaries') return route.fulfill({ json: makePage([salary]) });
    if (path === 'raise-requests' && request.method() === 'POST') {
      const body = request.postDataJSON();
      requests.push(body);
      return route.fulfill({
        status: 201,
        json: { id: String(100 + requests.length), version: '0', status: 'draft', ...body },
      });
    }
    if (path === 'raise-requests') return route.fulfill({ json: makePage(requests) });
    return route.fulfill({ json: makePage([]) });
  });

  await page.goto('/raise-requests');
  async function fillRequiredFields(target: string) {
    await page.getByRole('button', { name: 'Nuova richiesta', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Persona', { exact: true }).click();
    await page.getByRole('option', { name: /Persona Fittizia/ }).click();
    await dialog.getByLabel('RAL base', { exact: true }).click();
    await page.getByRole('option', { name: /45\.000,00 -/ }).click();
    await dialog.getByLabel('Data richiesta', { exact: true }).fill('04/11/2026');
    await dialog.getByLabel('RAL annua target (non incremento)', { exact: true }).fill(target);
    await dialog.getByLabel('Motivazione', { exact: true }).fill('Richiesta fittizia');
    return dialog;
  }

  const automaticDialog = await fillRequiredFields('45250.00');
  const automaticPercentage = automaticDialog.getByLabel('Percentuale aumento', {
    exact: true,
  });
  await expect(automaticPercentage).toHaveValue('0.6');
  await expect(automaticPercentage).toBeDisabled();
  await expect(automaticDialog.getByText(/backend salvera solo la RAL target/)).toBeVisible();
  await automaticDialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(automaticDialog).not.toBeVisible();
  expect(requests[0]).toEqual(
    expect.objectContaining({ requestedSalary: '45250.00', requestedPercentage: null }),
  );

  const manualDialog = await fillRequiredFields('');
  const manualPercentage = manualDialog.getByLabel('Percentuale aumento', { exact: true });
  await expect(manualPercentage).toBeEnabled();
  await manualPercentage.fill('5.25');
  await manualDialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(manualDialog).not.toBeVisible();
  expect(requests[1]).toEqual(
    expect.objectContaining({ requestedSalary: null, requestedPercentage: '5.25' }),
  );
});
