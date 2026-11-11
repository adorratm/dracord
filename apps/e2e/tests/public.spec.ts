import { test, expect } from '@playwright/test';
import { API_URL } from '../fixtures/env';

/** Oturum gerektirmeyen duman testleri — canlıya karşı da güvenle çalışır (hiçbir şey yazmaz). */
test.describe('herkese açık sayfalar', () => {
  test('API sağlık uçları', async ({ request }) => {
    for (const p of ['/health', '/v1/health']) {
      const res = await request.get(`${API_URL}${p}`);
      expect(res.ok(), `${p} → ${res.status()}`).toBeTruthy();
    }
  });

  test('ana sayfa açılır', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto('/');
    expect(res?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/Dracord/i);
    expect(errors, `sayfa hataları: ${errors.join(' | ')}`).toEqual([]);
  });

  test('giriş ekranı', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /Google ile giriş yap/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /hoş geldin/i })).toBeVisible();
  });

  test('oturumsuz kullanıcı sohbet ekranında kalmaz', async ({ page }) => {
    await page.goto('/channels/@me');
    // Tanıtım sayfasına ya da girişe yönlendirilir
    await expect(page).not.toHaveURL(/\/channels\//, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/(login)?$/);
  });

  test('indirme sayfası', async ({ page }) => {
    const res = await page.goto('/download');
    expect(res?.ok()).toBeTruthy();
  });

  test('olmayan tanıtım sayfası 404 döner', async ({ page }) => {
    const res = await page.goto('/s/e2e-boyle-bir-sunucu-yok-41');
    expect(res?.status()).toBe(404);
  });

  test('açık yönlendirme engelli (returnUrl=//)', async ({ page }) => {
    await page.goto('/login?returnUrl=//example.com');
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).host).not.toBe('example.com');
  });
});
