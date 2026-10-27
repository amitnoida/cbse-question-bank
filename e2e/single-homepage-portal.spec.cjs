const { test, expect } = require('@playwright/test');

test('Single colorful homepage is SEO indexable and links to Class 8–12 pages', async ({ page }) => {
  const response = await page.goto('/');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: /Practice Smarter/i })).toBeVisible();
  await expect(page.getByText('Score Better.')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://cbse-question-bank.vercel.app/');
  for (const n of [8, 9, 10, 11, 12]) {
    await expect(page.getByRole('link', { name: 'All chapters →' }).nth([8, 9, 10, 11, 12].indexOf(n))).toHaveAttribute('href', `/class-${n}`);
  }
  await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Financial-Year Membership' })).toBeVisible();
});

test('Student portal is a sign-in/register gateway rather than duplicate marketing', async ({ page }) => {
  const response = await page.goto('/app');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Welcome to your learning space.' })).toBeVisible({timeout:30000});
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Free.*Create Account/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Student sign in' })).toBeVisible();
});

test('SEO homepage signup action opens existing registration modal and ordered classes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Start Free/i }).first().click();
  await expect(page).toHaveURL(/\/app\?auth=signup/);
  const modal = page.getByRole('dialog', { name: 'Create student account' });
  await expect(modal).toBeVisible({timeout:30000});
  const classSelect = modal.locator('#student-field-5');
  await expect.poll(async () => classSelect.locator('option').evaluateAll(options =>
    options.map(o => o.textContent.trim()).filter(x => /^Class \d+$/.test(x))
  ), {timeout:30000}).toEqual(['Class 8','Class 9','Class 10','Class 11','Class 12']);
});

test('SEO homepage sign-in action opens the student sign-in modal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Student Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/app\?auth=signin/);
  await expect(page.getByRole('dialog', { name: 'Student sign in' })).toBeVisible({timeout:30000});
});
