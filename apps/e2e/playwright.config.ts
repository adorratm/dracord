import { defineConfig, devices } from '@playwright/test';

/**
 * Dracord web duman testleri.
 *
 * Ortam değişkenleri:
 *   E2E_BASE_URL       web adresi (varsayılan http://localhost:3000)
 *   E2E_API_URL        API adresi (varsayılan http://localhost:4000)
 *   E2E_REFRESH_TOKEN  test hesabının yenileme belirteci (oturum gerektiren testler için)
 *   E2E_CHANNEL        "<guildId>/<channelId>" — testlerin yazacağı metin kanalı (test sunucusu önerilir)
 *
 * Belirteç her yenilemede değiştiği için kurulum yeni belirteci `.auth/refresh-token` dosyasına yazar
 * ve sonraki çalıştırmalar onu kullanır (env yalnız ilk sefer gerekir).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'public', testMatch: /public\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'signed-in',
      testMatch: /(chat|resilience)\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/state.json', permissions: ['clipboard-read', 'clipboard-write'] },
    },
  ],
});
