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
    for (const value of [
      'Recapito fittizio',
      'Sede fittizia',
      'Residenza fittizia',
      'Manager fittizio',
      'Note fittizie',
    ]) {
      await expect(page.getByRole('definition').filter({ hasText: value })).toBeVisible();
    }
    const edit = page.getByRole('button', { name: 'Modifica', exact: true });
    const icon = edit.locator('svg[aria-hidden="true"]');
    await expect(icon).toBeVisible();
    expect(await icon.evaluate((svg) => svg.namespaceURI)).toBe('http://www.w3.org/2000/svg');
    expect(await icon.locator('path').getAttribute('d')).toBeTruthy();
    await edit.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ruolo', { exact: true }).fill('Ruolo aggiornato');
    await dialog.getByLabel('Note', { exact: true }).fill('Note aggiornate');
    await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole('definition').filter({ hasText: 'Ruolo aggiornato' }),
    ).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: 'Note aggiornate' })).toBeVisible();
    await page.getByRole('link', { name: 'Torna alle persone', exact: true }).click();
    await expect(personRow).toContainText('Ruolo aggiornato');
    expect(unexpected).toEqual([]);
  });
}
