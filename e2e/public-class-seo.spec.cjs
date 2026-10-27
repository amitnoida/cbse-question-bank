const { test, expect } = require('@playwright/test');

const classes = [8, 9, 10, 11, 12];
const lowerSubjects = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science'];
const seniorSubjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

for (const classNumber of classes) {
  test(`Public Class ${classNumber} SEO page exposes correct subjects`, async ({ page }) => {
    const response = await page.goto(`/class-${classNumber}`);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: `CBSE Class ${classNumber} MCQ practice` })).toBeVisible();
    const expected = classNumber <= 10 ? lowerSubjects : seniorSubjects;
    for (const name of expected) {
      await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
    }
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/class-${classNumber}$`));
  });
}

test('Public sitemap includes all Class 8–12 and correct subject routes', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  for (const classNumber of classes) {
    expect(xml).toContain(`/class-${classNumber}</loc>`);
    const expected = classNumber <= 10
      ? ['english','hindi','mathematics','science','social-science']
      : ['physics','chemistry','mathematics','biology'];
    for (const slug of expected) expect(xml).toContain(`/class-${classNumber}/${slug}</loc>`);
  }
  expect(xml).not.toContain('/class-11/english</loc>');
  expect(xml).not.toContain('/class-12/science</loc>');
});

test('Student signup offers Classes 8, 9, 10, 11 and 12 in numeric order', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('button', { name: /^Start Free/i }).first().click();
  const select = page.getByRole('dialog', { name: 'Create student account' }).locator('#student-field-5');
  await expect(select).toBeVisible();
  await expect.poll(async () => {
    return select.locator('option').evaluateAll(options =>
      options.map(option => option.textContent.trim()).filter(x => /^Class \d+$/.test(x)));
  }, { timeout: 30000 }).toEqual(['Class 8','Class 9','Class 10','Class 11','Class 12']);
});

test('Class 11 subject routes do not imply Class 9 subjects are available', async ({ request }) => {
  const valid = await request.get('/class-11/physics');
  expect(valid.status()).toBe(200);
  const invalid = await request.get('/class-11/english');
  expect(invalid.status()).toBe(404);
});
