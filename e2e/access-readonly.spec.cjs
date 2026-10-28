const { test, expect } = require('@playwright/test');
const accounts = JSON.parse(process.env.E2E_ACCOUNTS_JSON || '[]').filter(a => a.kind === 'admin' || /^test_(8|9|10|11|12)_(free|paid)@gmail\.com$/i.test(a.email || ''));
if (!Array.isArray(accounts) || accounts.length !== 12) throw new Error('Expected 12 configured school and admin test accounts');
for (const [index, account] of accounts.entries()) {
  if (!account || typeof account.email !== 'string' || typeof account.password !== 'string' || !['student','admin'].includes(account.kind)) throw new Error('Invalid account entry');
  test('read-only dashboard and access audit for account ' + (index + 1) + ' (' + account.kind + ')', async ({page}) => {
    if (account.kind === 'student') {
      await page.goto('/app');
      await page.getByRole('button', {name:/^sign in$/i}).first().click();
      const dialog = page.getByRole('dialog', {name:'Student sign in'});
      await dialog.locator('input[type=email]').fill(account.email);
      await dialog.locator('input[type=password]').fill(account.password);
      await dialog.getByRole('button', {name:/^sign in$/i}).click();
      await expect(dialog).toBeHidden({timeout:25000});
      await expect(page.getByRole('heading',{name:/what will you learn today/i})).toBeVisible({timeout:25000});
      await expect(page.locator('#practice-subject')).toBeVisible();
      await expect(page.locator('#student-field-12')).toBeDisabled();
      const membershipButton = page.getByRole('button',{name:/Premium Active|Subscribe ₹99/i}).first();
      await expect(membershipButton).toBeVisible({timeout:25000});
      const expectedPaid = /_paid@gmail\.com$/i.test(account.email);
      if (expectedPaid) await expect(membershipButton).toContainText('Premium Active');
      else await expect(membershipButton).toContainText('Subscribe ₹99');
      await expect(page.getByRole('link',{name:/Dashboard/i}).first()).toBeVisible();
    } else {
      await page.goto('/admin');
      await page.locator('input[type=email]').fill(account.email);
      await page.locator('input[type=password]').fill(account.password);
      await page.getByRole('button',{name:/^sign in$/i}).click();
      await expect(page.getByRole('heading',{name:'Management overview'})).toBeVisible({timeout:25000});
      await expect(page.getByText('Signed in as ' + account.email)).toBeVisible();
      // Verify authorization-backed summary, not merely a valid Supabase session.
      await expect(page.getByText('Registered students',{exact:true})).toBeVisible({timeout:25000});
      await expect(page.getByText('Admin users',{exact:true})).toBeVisible();
    }
  });
}
