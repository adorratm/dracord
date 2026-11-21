import { defineConfig } from '@playwright/test';

/** Masaüstü (Electron) duman testleri — `yarn workspace @dracord/e2e test:desktop` */
export default defineConfig({
  testDir: './desktop',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-desktop' }]] : [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
