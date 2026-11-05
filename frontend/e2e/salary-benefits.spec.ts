import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`salary benefits are grouped, saved and inherited with editable overrides at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    const base = {
      id: '10',
      personId: '1',
      amount: '50000.00',
      currency: 'EUR',
      effectiveOn: '2025-01-01',
      contractType: 'Contratto fittizio',
      weeklyHours: '40.00',
      classificationLevel: 'Livello fittizio',
      reason: 'Motivo fittizio',
      mealVouchers: true,
      bonusLetterAmount: '1500.00',
      companyCar: false,
      sourceRaiseRequestId: null,
    };
    const salaries = [base];
    let request = {
      id: '20',
      version: '0',
      personId: '1',
      baseSalaryId: '10',
      requestedOn: '2026-01-01',
      requestedSalary: '55000.00',
      requestedPercentage: '10',
      motivation: 'Richiesta fittizia',
      status: 'submitted',
      benefits: { mealVouchers: false, bonusLetterAmount: '2000.00', companyCar: true },
    };
    let created = false;
    let approved = false;
    let proposalEdited = false;
    const unexpected: string[] = [];
    await page.route('**/api/v1/**', async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname.replace('/api/v1/', '');
      if (path === 'auth/me')
        return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
      if (path === 'auth/csrf')
        return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
      if (path === 'notifications') return route.fulfill({ json: empty });
      if (path === 'people')
        return route.fulfill({
          json: {
            ...empty,
            items: [{ id: '1', firstName: 'Persona', lastName: 'Fittizia' }],
            totalElements: 1,
            totalPages: 1,
          },
        });
      if (path === 'people/1')
        return route.fulfill({
          json: {
            id: '1',
            firstName: 'Persona',
            lastName: 'Fittizia',
            status: 'active',
            frameworks: [],
          },
        });
      if (path === 'people/1/timeline') return route.fulfill({ json: empty });
      if (path === 'people/1/salaries') {
        if (req.method() === 'POST') {
          const body = req.postDataJSON();
          expect(body).toMatchObject({
            mealVouchers: false,
            bonusLetterAmount: '0.00',
            companyCar: true,
            currency: 'EUR',
          });
          salaries.push({ ...base, ...body, id: '11' });
          created = true;
          return route.fulfill({ status: 201, json: salaries[1] });
        }
        return route.fulfill({
          json: { ...empty, items: salaries, totalElements: salaries.length, totalPages: 1 },
        });
      }
      if (path === 'people/1/salary-trend')
        return route.fulfill({
          json: { ...empty, items: salaries, totalElements: salaries.length, totalPages: 1 },
        });
      if (path === 'raise-requests')
        return route.fulfill({
          json: { ...empty, items: [request], totalElements: 1, totalPages: 1 },
        });
      if (path === 'raise-requests/20' && req.method() === 'PUT') {
        expect(req.postDataJSON()).toMatchObject({
          benefits: { mealVouchers: false, bonusLetterAmount: '2200.00', companyCar: true },
        });
        expect(req.postDataJSON()).not.toHaveProperty('mealVouchers');
        request = { ...request, ...req.postDataJSON(), version: '1' };
        proposalEdited = true;
        return route.fulfill({ json: request });
      }
      if (path === 'raise-requests/20/approve') {
        expect(req.postDataJSON()).toMatchObject({
          createSalary: true,
          effectiveOn: '2026-12-01',
          benefits: { mealVouchers: false, bonusLetterAmount: null, companyCar: true },
        });
        request = { ...request, status: 'approved', version: '1' };
        approved = true;
        return route.fulfill({ json: request });
      }
      unexpected.push(`${req.method()} ${path}`);
      return route.abort();
    });

    await page.goto('/people/1');
    await page.getByRole('tab', { name: 'RAL', exact: true }).click();
    await page.getByRole('button', { name: 'Nuova voce RAL', exact: true }).click();
    let dialog = page.getByRole('dialog');
    const benefitGroup = dialog.getByRole('group', { name: 'Benefit', exact: true });
    await expect(benefitGroup).toBeVisible();
    await dialog.getByLabel('RAL annua (es. 45000.00)', { exact: true }).fill('51000.00');
    await dialog.getByLabel('Decorrenza', { exact: true }).fill('01/11/2026');
    await dialog.getByLabel('Tipo contratto', { exact: true }).fill('Contratto fittizio');
    await dialog.getByLabel('Ore settimanali', { exact: true }).fill('40.00');
    await dialog.getByLabel('Livello di inquadramento', { exact: true }).fill('Livello fittizio');
    await dialog.getByLabel('Motivo della variazione', { exact: true }).fill('Motivo fittizio');
    await benefitGroup.getByRole('combobox', { name: 'Buoni pasto', exact: true }).click();
    await page.getByRole('option', { name: 'No', exact: true }).click();
    await benefitGroup.getByLabel('Lettera di bonus', { exact: true }).fill('0.00');
    await benefitGroup.getByRole('combobox', { name: 'Auto', exact: true }).click();
    await page.getByRole('option', { name: 'Si', exact: true }).click();
    await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(created).toBe(true);
    const salaryRow = page.getByRole('row').filter({ hasText: '51.000,00' });
    await expect(
      salaryRow.getByRole('img', { name: 'Buoni pasto: No', exact: true }),
    ).toBeVisible();
    await expect(
      salaryRow.getByRole('img', { name: 'Lettera di bonus: 0,00', exact: true }),
    ).toBeVisible();
    await expect(salaryRow.getByRole('img', { name: 'Auto: Si', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Benefit', exact: true })).toHaveCount(1);

    await page
      .getByRole('row')
      .filter({ hasText: '51.000,00' })
      .getByRole('button', { name: 'Dettagli', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Benefit', exact: true })).toBeVisible();
    await expect(dialog.getByRole('definition').filter({ hasText: /^\s*0,00\s*$/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();

    await page.getByRole('tab', { name: 'Aumenti', exact: true }).click();
    await page
      .getByRole('row')
      .filter({ hasText: '55.000,00' })
      .getByRole('button', { name: 'Azioni', exact: true })
      .click();
    await page.getByRole('menuitem', { name: 'Modifica', exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Lettera di bonus', { exact: true })).toHaveValue('2000.00');
    await dialog.getByLabel('Lettera di bonus', { exact: true }).fill('2200.00');
    await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(proposalEdited).toBe(true);
    await page
      .getByRole('row')
      .filter({ hasText: '55.000,00' })
      .getByRole('button', { name: 'Azioni', exact: true })
      .click();
    await page.getByRole('menuitem', { name: 'Approva', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Generare nuova RAL?', exact: true }).click();
    await page.getByRole('option', { name: 'Si', exact: true }).click();
    await expect(dialog.getByRole('combobox', { name: 'Buoni pasto', exact: true })).toContainText(
      'No',
    );
    await expect(dialog.getByLabel('Lettera di bonus', { exact: true })).toHaveValue('2200.00');
    await expect(dialog.getByRole('combobox', { name: 'Auto', exact: true })).toContainText('Si');
    await dialog
      .getByLabel('Decorrenza RAL (solo se generata)', { exact: true })
      .fill('01/12/2026');
    await dialog.getByRole('combobox', { name: 'Buoni pasto', exact: true }).click();
    await page.getByRole('option', { name: 'No', exact: true }).click();
    await dialog.getByLabel('Lettera di bonus', { exact: true }).fill('');
    await dialog.getByRole('combobox', { name: 'Auto', exact: true }).click();
    await page.getByRole('option', { name: 'Si', exact: true }).click();
    await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(approved).toBe(true);
    expect(unexpected).toEqual([]);
  });
}
