import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`new person labels and phone selector do not overlap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const empty = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1/', '');
      if (path === 'auth/me')
        return route.fulfill({ json: { id: '1', username: 'utente-fittizio' } });
      if (path === 'auth/csrf')
        return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf-fittizio' } });
      if (path === 'people') return route.fulfill({ json: empty });
      throw new Error(`Unexpected API request: ${path}`);
    });
    await page.goto('/people');
    await page.getByRole('button', { name: 'Nuova persona', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const name = dialog.getByLabel('Nome', { exact: true });
    await expect(name).toBeFocused();
    const firstLabel = dialog.locator('mat-form-field').first().locator('.mdc-floating-label');
    await expect
      .poll(async () =>
        firstLabel.evaluate((label) => {
          const content = label.closest('mat-dialog-content')!.getBoundingClientRect();
          const bounds = label.getBoundingClientRect();
          return bounds.top >= content.top && bounds.bottom <= content.bottom;
        }),
      )
      .toBe(true);

    const phone = dialog.getByLabel('Telefono', { exact: true });
    await phone.scrollIntoViewIfNeeded();
    await expect(dialog.locator('.iti__selected-country')).toBeVisible();
    const phoneLabel = dialog
      .locator('mat-form-field')
      .filter({ has: page.locator('input[type="tel"]') })
      .locator('.mdc-floating-label');
    await expect
      .poll(async () =>
        phoneLabel.evaluate((label) => {
          const selector = label
            .closest('mat-form-field')!
            .querySelector('.iti__selected-country')!
            .getBoundingClientRect();
          const bounds = label.getBoundingClientRect();
          return bounds.bottom <= selector.top || bounds.left >= selector.right;
        }),
      )
      .toBe(true);
    await phone.fill('02 12345678');
    await expect
      .poll(async () =>
        phone.evaluate((element) => {
          const input = element as HTMLInputElement;
          const selector = input
            .closest('.iti')!
            .querySelector('.iti__selected-country')!
            .getBoundingClientRect();
          const textLeft =
            input.getBoundingClientRect().left + parseFloat(getComputedStyle(input).paddingLeft);
          return textLeft >= selector.right + 4;
        }),
      )
      .toBe(true);
    await dialog.locator('.iti__selected-country').click();
    await expect(page.locator('.iti__country-list')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(phone).toHaveValue('02 12345678');
  });
}
