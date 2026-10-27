const { test, expect } = require('@playwright/test');
let accounts = [];
try {
  accounts = JSON.parse(process.env.E2E_ACCOUNTS_JSON || '[]');
} catch {
  throw new Error('E2E_ACCOUNTS_JSON must be a valid JSON array');
}
if (!Array.isArray(accounts)) throw new Error('E2E_ACCOUNTS_JSON must be an array');
for (const [index, account] of accounts.entries()) {
  if (!account || typeof account.email !== 'string' || typeof account.password !== 'string' || !['student', 'admin'].includes(account.kind)) {
    throw new Error('Each test account requires email, password and kind: student or admin');
  }
  test('login and access check for account ' + (index + 1) + ' (' + account.kind + ')', async ({ page }) => {
    const isAdmin = account.kind === 'admin';
    await page.goto(isAdmin ? '/admin' : '/app');
    if (isAdmin) {
      await page.locator('input[type=email]').fill(account.email);
      await page.locator('input[type=password]').fill(account.password);
      await page.getByRole('button', { name: /^sign in$/i }).click();
      await expect(page.getByText('Administrator sign in')).toBeHidden({ timeout: 25000 });
      await expect(page).toHaveURL(/\/admin/);
    } else {
      await page.getByRole('button', { name: /^sign in$/i }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Student sign in' });
      await expect(dialog).toBeVisible();
      await dialog.locator('input[type=email]').fill(account.email);
      await dialog.locator('input[type=password]').fill(account.password);
      await dialog.getByRole('button', { name: /^sign in$/i }).click();
      await expect(dialog).toBeHidden({ timeout: 25000 });
      await expect(page).toHaveURL(/\/(app|dashboard)(\/|$)/);
    }
    // No practice/mock submissions or database mutations in this first-stage smoke test.
  });
}
