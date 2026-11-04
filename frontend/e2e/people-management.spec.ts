import { test, expect, Page, Locator } from '@playwright/test';

const username = process.env['E2E_USERNAME'];
const password = process.env['E2E_PASSWORD'];
if (!username || !password)
  throw new Error(
    'E2E_USERNAME and E2E_PASSWORD are required for an isolated fictitious database.',
  );

async function login(page: Page) {
  await page.goto('/people');
  await expect(page.getByRole('heading', { name: 'Accedi a myRI' })).toBeVisible();
  await page.getByLabel('Nome utente').fill(username!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Persone', exact: true })).toBeVisible();
}
async function choose(dialog: Locator, label: string, option: string | RegExp) {
  await dialog.getByLabel(label, { exact: true }).click();
  await dialog.page().getByRole('option', { name: option }).click();
}
async function save(page: Page) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function confirm(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Conferma', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

test('real session, CRUD, immutable salary, raise approval, recurrence, timeline and logout', async ({
  page,
}) => {
  test.setTimeout(120000);
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.name));
  await login(page);
  const suffix = Date.now().toString();
  const firstName = 'PersonaE2E' + suffix;
  await page.getByRole('button', { name: 'Nuova persona', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill(firstName);
  await dialog.getByLabel('Cognome', { exact: true }).fill('Fittizia');
  await dialog.getByLabel('Email', { exact: true }).fill(`e2e-${suffix}@example.test`);
  await dialog.getByLabel('MyPad ID', { exact: true }).fill('fictitious-' + suffix);
  await dialog.getByLabel('Data di assunzione').fill('02/01/2026');
  await dialog.getByLabel('Data di inizio lavoro').fill('02/01/2020');
  await choose(dialog, 'Livello di seniority', 'Medior');
  await dialog.getByLabel('Sede di assunzione').fill('Sede fittizia');
  await dialog.getByLabel('Residenza').fill('Residenza fittizia');
  await save(page);
  await page.getByLabel('Cerca', { exact: true }).fill(firstName);
  await page.getByRole('button', { name: 'Applica filtri', exact: true }).click();
  let row = page.getByRole('row').filter({ hasText: firstName });
  await expect(row).toBeVisible();
  await expect(row.getByRole('button', { name: 'Dettagli', exact: true })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Modifica', exact: true })).toHaveCount(0);
  await row.getByRole('link', { name: 'Scheda', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: firstName + ' Fittizia', exact: true }),
  ).toBeVisible();
  const information = page.getByRole('definition');
  await expect(page.getByText('Data di assunzione', { exact: true })).toBeVisible();
  await expect(page.getByText('Data di inizio lavoro', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Apri MyPad (nuova scheda)' })).toHaveAttribute(
    'href',
    `https://mypad.altengroup.com/employees/fictitious-${suffix}`,
  );
  await expect(information.filter({ hasText: 'Sede fittizia' })).toBeVisible();
  await expect(information.filter({ hasText: 'Residenza fittizia' })).toBeVisible();
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Ruolo', { exact: true }).fill('Team engineer');
  await page.getByRole('dialog').getByLabel('Note', { exact: true }).fill('Nota persona fittizia');
  await save(page);
  await expect(information.filter({ hasText: 'Team engineer' })).toBeVisible();
  await expect(information.filter({ hasText: 'Nota persona fittizia' })).toBeVisible();
  const personUrl = page.url();

  await page.getByRole('tab', { name: 'Contatti', exact: true }).click();
  await page.getByRole('button', { name: 'Nuovo contatto', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tipo', { exact: true }).fill('Chat');
  await dialog.getByLabel('Recapito o riferimento').fill('fittizio.test');
  await save(page);
  row = page.getByRole('row').filter({ hasText: 'fittizio.test' });
  await row.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Note', { exact: true }).fill('Nota fittizia');
  await save(page);
  await expect(row).toContainText('Nota fittizia');
  await row.getByRole('button', { name: 'Dettagli', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Nota fittizia');
  await page.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).click();
  await row.getByRole('button', { name: 'Archivia', exact: true }).click();
  await confirm(page);
  await expect(row).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Includi archiviati' }).check();
  await page.getByRole('button', { name: 'Applica filtri', exact: true }).click();
  await expect(row).toContainText('Archiviato');
  await expect(row.getByRole('button', { name: 'Modifica', exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: 'RAL', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova voce RAL', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('RAL annua (es. 45000.00)', { exact: true }).fill('45000.00');
  await dialog.getByLabel('Decorrenza', { exact: true }).fill('02/01/2026');
  await dialog.getByLabel('Tipo contratto', { exact: true }).fill('Tempo indeterminato');
  await dialog.getByLabel('Ore settimanali', { exact: true }).fill('40.00');
  await dialog.getByLabel('Livello di inquadramento', { exact: true }).fill('Livello fittizio');
  await dialog.getByLabel('Motivo della variazione').fill('RAL fittizia iniziale');
  await save(page);
  row = page.getByRole('row').filter({ hasText: 'RAL fittizia iniziale' });
  await expect(row).toContainText('45.000,00');
  await expect(row.getByRole('button', { name: 'Modifica', exact: true })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Archivia', exact: true })).toHaveCount(0);
  await expect(row).toContainText('Tempo indeterminato');
  await expect(row).toContainText('40,00');
  await expect(row).toContainText('Livello fittizio');

  await page.getByRole('tab', { name: 'Aumenti', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova richiesta', exact: true }).click();
  dialog = page.getByRole('dialog');
  await choose(dialog, 'RAL base', /45.000,00 EUR/);
  await dialog.getByLabel('Data richiesta', { exact: true }).fill('01/10/2026');
  await dialog.getByLabel('RAL annua target (non incremento)', { exact: true }).fill('48000.00');
  await dialog.getByLabel('Motivazione', { exact: true }).fill('Percorso fittizio');
  await save(page);
  row = page.getByRole('row').filter({ hasText: '48.000,00' });
  await row.getByRole('button', { name: 'Invia', exact: true }).click();
  await confirm(page);
  await expect(row).toContainText('Inviata');
  await row.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Motivazione', { exact: true })
    .fill('Trattativa fittizia aggiornata');
  await save(page);
  await expect(row).toContainText('Inviata');
  await row.getByRole('button', { name: 'Approva', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Data esito', { exact: true }).fill('02/11/2026');
  await choose(dialog, 'Generare nuova RAL?', 'Si');
  await dialog.getByLabel('Decorrenza RAL (solo se generata)').fill('01/12/2026');
  await save(page);
  await expect(row).toContainText('Approvata');
  await expect(row.getByRole('button', { name: 'Modifica', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'RAL', exact: true }).click();
  const generatedSalary = page.getByRole('row').filter({ hasText: '48.000,00' });
  await expect(generatedSalary).toHaveCount(1);
  await expect(generatedSalary).toContainText('Tempo indeterminato');
  await expect(generatedSalary).toContainText('40,00');
  await expect(generatedSalary).toContainText('Livello fittizio');

  await page.getByRole('tab', { name: 'Career talk', exact: true }).click();
  await page.getByRole('button', { name: 'Nuovo career talk', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Data e ora incontro (UTC)').fill('15/10/2026 10:00');
  await dialog.getByLabel('Argomenti', { exact: true }).fill('Crescita fittizia');
  await save(page);
  row = page.getByRole('row').filter({ hasText: 'Crescita fittizia' });
  await row.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Prossimi passi').fill('Prossimi passi fittizi');
  await save(page);
  await expect(row).toContainText('15/10/2026');

  await page.getByRole('tab', { name: 'Task', exact: true }).click();
  await page.getByRole('button', { name: 'Nuovo task', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titolo', { exact: true }).fill('Follow-up ' + suffix);
  await dialog.getByLabel('Scadenza (UTC)').fill('15/12/2026 10:00');
  await choose(dialog, 'Ricorrenza', 'Mensile');
  await dialog.getByLabel('Intervallo ricorrenza').fill('1');
  await choose(dialog, 'Career talk collegato', /15\/10\/2026/);
  await save(page);
  row = page.getByRole('row').filter({ hasText: 'Follow-up ' + suffix });
  await row.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Descrizione', { exact: true })
    .fill('Azione fittizia aggiornata');
  await save(page);
  await row.getByRole('button', { name: 'Completa', exact: true }).click();
  await confirm(page);
  await expect(page.getByRole('row').filter({ hasText: 'Follow-up ' + suffix })).toHaveCount(2);
  await expect(page.getByRole('row').filter({ hasText: 'Completato' })).toHaveCount(1);
  const successor = page
    .getByRole('row')
    .filter({ hasText: 'Follow-up ' + suffix })
    .filter({ has: page.getByRole('button', { name: 'Annulla task', exact: true }) });
  await successor.getByRole('button', { name: 'Annulla task', exact: true }).click();
  await confirm(page);
  await expect(page.getByRole('row').filter({ hasText: 'Annullato' })).toHaveCount(1);

  await page.getByRole('tab', { name: 'Timeline', exact: true }).click();
  await expect(page.locator('.timeline')).toContainText('Variazione RAL');
  await expect(page.locator('.timeline')).toContainText('Career talk');
  await expect(page.locator('.timeline')).toContainText('Follow-up ' + suffix);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: firstName + ' Fittizia', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(personUrl);
  await page.getByRole('button', { name: 'Esci', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accedi a myRI' })).toBeVisible();
  await page.goto(personUrl);
  await expect(page.getByRole('heading', { name: 'Accedi a myRI' })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('invalid login, session expiration, server error, and narrow-screen navigation', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Nome utente').fill(username!);
  await page.getByLabel('Password', { exact: true }).fill('fictitious-wrong-password');
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Nome utente o password non validi');
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Task', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Task', exact: true })).toBeVisible();
  await page.route('**/api/v1/tasks?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: '{"detail":"Servizio temporaneamente non disponibile."}',
    }),
  );
  await page.getByRole('button', { name: 'Ricarica', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Servizio temporaneamente non disponibile');
  await page.unrouteAll();
  await page.getByRole('button', { name: 'Nuovo task', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.context().clearCookies();
  await page
    .getByRole('dialog')
    .getByLabel('Titolo', { exact: true })
    .fill('Sessione fittizia scaduta');
  await page.getByRole('dialog').getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accedi a myRI' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('conflicts stay visible without replaying or discarding form values', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Task', exact: true }).click();
  await page.getByRole('button', { name: 'Nuovo task', exact: true }).click();
  let dialog = page.getByRole('dialog');
  const title = 'Conflitto fittizio ' + Date.now();
  await dialog.getByLabel('Titolo', { exact: true }).fill(title);
  await save(page);
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Modifica', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrizione', { exact: true }).fill('Modifica locale non persa');
  let requests = 0;
  await page.route('**/api/v1/tasks/*', (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    requests++;
    return route.fulfill({
      status: 409,
      contentType: 'application/problem+json',
      body: '{"detail":"Versione obsoleta."}',
    });
  });
  await dialog.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Conflitto');
  await expect(dialog.getByLabel('Descrizione', { exact: true })).toHaveValue(
    'Modifica locale non persa',
  );
  expect(requests).toBe(1);
  await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
});

test('dashboard, calendar todo, scheduled notification, salary trend and persona exports', async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  const suffix = Date.now().toString();
  const firstName = 'ExportE2E' + suffix;
  await page.getByRole('button', { name: 'Nuova persona', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill(firstName);
  await dialog.getByLabel('Cognome', { exact: true }).fill('Fittizia');
  await dialog.getByLabel('MyPad ID', { exact: true }).fill('fictitious-export-' + suffix);
  await dialog.getByLabel('Data di assunzione').fill('02/01/2020');
  await save(page);
  await page.getByLabel('Cerca', { exact: true }).fill(firstName);
  await page.getByRole('button', { name: 'Applica filtri', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: firstName })
    .getByRole('link', { name: 'Scheda', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: firstName + ' Fittizia', exact: true }),
  ).toBeVisible();
  const personPath = new URL(page.url()).pathname;
  await page.getByRole('tab', { name: 'RAL', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova voce RAL', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('RAL annua (es. 45000.00)', { exact: true }).fill('45000.12');
  await dialog.getByLabel('Decorrenza', { exact: true }).fill('01/01/2099');
  await dialog.getByLabel('Tipo contratto', { exact: true }).fill('Tempo determinato');
  await dialog.getByLabel('Ore settimanali', { exact: true }).fill('32.00');
  await dialog.getByLabel('Livello di inquadramento', { exact: true }).fill('Livello fittizio');
  await dialog.getByLabel('Motivo della variazione').fill('Andamento fittizio');
  await save(page);
  await page.getByRole('tab', { name: 'Andamento RAL', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Andamento fittizio' })).toContainText(
    '45.000,12',
  );
  await expect(page.getByRole('row').filter({ hasText: 'Andamento fittizio' })).toContainText(
    'Futura',
  );
  for (const format of ['JSON', 'CSV']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Esporta ${format}`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`person-export.${format.toLowerCase()}`);
    expect(await download.failure()).toBeNull();
    const stream = await download.createReadStream();
    const parts: Buffer[] = [];
    for await (const part of stream!) parts.push(Buffer.from(part));
    const text = Buffer.concat(parts).toString('utf8');
    expect(text).toContain(firstName);
    if (format === 'JSON') {
      const snapshot = JSON.parse(text);
      expect(snapshot.schemaVersion).toBe(1);
      expect(snapshot.salaries[0].amount).toBe('45000.12');
    } else expect(text).toContain('recordType,schemaVersion,exportedAt');
    await download.delete();
  }
  await page.route('**/export?format=json', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/problem+json',
      body: '{"detail":"Export oltre 1000 record, nessun dato troncato."}',
    }),
  );
  await page.getByRole('button', { name: 'Esporta JSON', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('nessun dato troncato');
  await page.unrouteAll();
  await page.getByRole('tab', { name: 'Task', exact: true }).click();
  await page.getByRole('button', { name: 'Nuovo task', exact: true }).click();
  dialog = page.getByRole('dialog');
  const title = 'ReminderE2E' + suffix;
  await dialog.getByLabel('Titolo', { exact: true }).fill(title);
  const nowUtc = new Date(Date.now() - 60000).toISOString().slice(0, 16);
  const [date, time] = nowUtc.split('T');
  await dialog.getByLabel('Scadenza (UTC)').fill(`${date.split('-').reverse().join('/')} ${time}`);
  await save(page);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Vedi scaduti', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: title })).toBeVisible();
  await expect(page.getByLabel('Cerca', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Notifiche', exact: true }).click();
  const notification = page
    .locator('li')
    .filter({ has: page.locator(`a[href="${personPath}"]`) })
    .filter({ hasText: 'Career talk da pianificare' });
  await expect(async () => {
    await page.getByRole('button', { name: 'Aggiorna notifiche', exact: true }).click();
    await expect(notification).toBeVisible();
  }).toPass({ timeout: 20000, intervals: [1000] });
  await notification.getByRole('button', { name: 'Segna letta', exact: true }).click();
  await expect(notification).toContainText('Letta');
  await notification.getByRole('button', { name: 'Archivia notifica', exact: true }).click();
  await expect(notification).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Includi archiviati' }).check();
  await page.getByRole('button', { name: 'Aggiorna notifiche', exact: true }).click();
  await expect(notification).toContainText('Archiviata');
  const taskNotification = page.locator('li').filter({ hasText: 'Task in scadenza #' }).first();
  await taskNotification.getByRole('button', { name: 'Apri task', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
