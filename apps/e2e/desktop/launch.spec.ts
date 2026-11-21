import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import path from 'node:path';

/**
 * Masaüstü duman testi: paketlenmemiş uygulamayı (apps/desktop + kopyalanmış ui/) açar.
 * Ana pencere giriş ekranına gelmeli, sayfada yakalanmamış hata olmamalı, köprü (preload) yüklenmeli.
 * Windows CI'da ve yerelde Xvfb ile çalışır.
 */
const desktopDir = path.resolve(__dirname, '..', '..', 'desktop');
let app: ElectronApplication;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [desktopDir, '--no-sandbox'],
    cwd: desktopDir,
    env: {
      ...process.env,
      // güncelleme denetimi / tek örnek kilidi testi bekletmesin
      DRACORD_DISABLE_UPDATER: '1',
      DRACORD_E2E: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
    timeout: 60_000,
  });
});

test.afterAll(async () => {
  await app?.close().catch(() => undefined);
});

async function mainWindow() {
  // açılış/güncelleme penceresi önce gelebilir — giriş ekranını gösteren pencereyi bul
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      const url = w.url();
      if (url.includes('index.html') || url.startsWith('http://127.0.0.1')) return w;
    }
    await app.waitForEvent('window', { timeout: 5_000 }).catch(() => undefined);
  }
  throw new Error(`ana pencere açılmadı: ${app.windows().map((w) => w.url()).join(', ')}`);
}

test('uygulama açılır ve giriş ekranı görünür', async () => {
  const win = await mainWindow();
  const errors: string[] = [];
  win.on('pageerror', (e) => errors.push(String(e)));
  await win.waitForLoadState('domcontentloaded');
  await expect(win.getByRole('button', { name: /giriş|google|github|passkey|devam/i }).first()).toBeVisible({ timeout: 30_000 });
  const bridge = await win.evaluate(() => typeof (window as unknown as { dracordDesktop?: unknown }).dracordDesktop);
  expect(bridge).toBe('object');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('sürüm köprüden okunur', async () => {
  const win = await mainWindow();
  const v = await win.evaluate(() =>
    (window as unknown as { dracordDesktop?: { getAppVersion?: () => Promise<string> } }).dracordDesktop?.getAppVersion?.(),
  );
  expect(String(v)).toMatch(/^\d+\.\d+\.\d+/);
});
