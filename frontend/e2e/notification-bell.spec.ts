import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`unread bell panel, navigation, row menu and retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    let unread = Array.from({ length: 7 }, (_, index) => ({
      id: String(index + 1),
      version: '0',
      personId: '1',
      taskId: String(index + 10),
      kind: 'task_due',
      triggeredAt: '2026-01-01T10:00:00Z',
      readAt: null,
      archivedAt: null,
    }));
    let readCalls = 0;
    let failInbox = false;
    const unexpected: string[] = [];
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace('/api/v1/', '');
      if (path === 'auth/me')
        return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
      if (path === 'auth/csrf')
        return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
      if (path === 'dashboard')
        return route.fulfill({
          json: {
            asOf: '2026-01-01T10:00:00Z',
            timezone: 'Europe/Rome',
            todayTasks: 0,
            overdueTasks: 0,
            nextSevenTasks: 0,
            openRaiseRequests: 0,
            unreadNotifications: 7,
            peopleWithoutRecentTalk: 0,
            careerMonths: 3,
          },
        });
      if (path === 'dashboard/career-due') return route.fulfill({ json: empty });
      if (path === 'notifications') {
        expect(url.searchParams.get('unreadOnly')).toBe('true');
        const size = Number(url.searchParams.get('size'));
        if (failInbox && size === 5) return route.fulfill({ status: 503, json: {} });
        return route.fulfill({
          json: {
            ...empty,
            size,
            items: unread.slice(0, size),
            totalElements: unread.length,
            totalPages: Math.ceil(unread.length / size),
          },
        });
      }
      if (path === 'notifications/1/read') {
        expect(request.postDataJSON()).toEqual({ version: '0' });
        readCalls++;
        unread = unread.filter((item) => item.id !== '1');
        return route.fulfill({ json: {} });
      }
      unexpected.push(`${request.method()} ${path}`);
      return route.abort();
    });
    await page.goto('/dashboard');
    await expect(page.locator('mat-card h2 svg')).toHaveCount(5);
    const bell = page.getByRole('button', { name: 'Notifiche non lette: 7', exact: true });
    await expect(bell).toBeVisible();
    await bell.focus();
    await bell.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu.getByText('Mostrate 5 di 7 notifiche non lette.')).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(7);
    expect(readCalls).toBe(0);
    await menu.getByRole('menuitem', { name: 'Vedi tutte le non lette', exact: true }).click();
    await expect(page).toHaveURL(/\/notifications\?unread=true$/);
    await expect(page.getByRole('checkbox', { name: 'Solo non lette' })).toBeChecked();
    await page
      .locator('.timeline > li')
      .first()
      .getByRole('button', { name: 'Azioni', exact: true })
      .click();
    await page.getByRole('menuitem', { name: 'Segna letta', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Notifiche non lette: 6', exact: true }),
    ).toBeVisible();
    expect(readCalls).toBe(1);
    failInbox = true;
    await page.getByRole('button', { name: 'Notifiche non lette: 6', exact: true }).click();
    await expect(menu.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Notifiche non disponibili', exact: true }),
    ).toBeVisible();
    failInbox = false;
    await menu.getByRole('menuitem', { name: 'Riprova', exact: true }).click();
    await expect(menu.getByRole('alert')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Notifiche non lette: 6', exact: true }),
    ).toBeVisible();
    expect(unexpected).toEqual([]);
  });
}
