const { test, expect } = require('@playwright/test');

test('retired Advanced Mock route is unavailable', async ({ request }) => {
  for (const path of ['/advanced-mock', '/advanced-mock?subject=Chemistry']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});
