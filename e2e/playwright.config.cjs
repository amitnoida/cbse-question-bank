const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.cjs',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }], ['json', { outputFile: 'results/results.json' }]],
  outputDir: 'results/artifacts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://cbse-question-bank.vercel.app',
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15000
  }
});
