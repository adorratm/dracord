import { test, expect } from '@playwright/test';
import { cleanup, me, sendMessage } from '../fixtures/api';
import { hasSession, testChannel } from '../fixtures/env';

/**
 * Bağlantı dayanıklılığı: ağ koptuğunda gönderilen mesaj, ağ gelince sayfayı yenilemeden görünmeli
 * (yeniden bağlanınca kanal odasına geri katılım + kaçırılanları tamamlama).
 */
const ch = testChannel();
let myId = '';
const startedAt = Date.now();

test.beforeAll(async () => {
  test.skip(!hasSession() || !ch, 'E2E_REFRESH_TOKEN / E2E_CHANNEL yok');
  myId = (await me()).id;
});

test.afterAll(async () => {
  if (ch && myId) await cleanup(ch.channelId, myId, startedAt);
});

test('çevrimdışıyken gelen mesaj, ağ dönünce görünür', async ({ page, context }) => {
  await page.goto(`/channels/${ch!.guildId}/${ch!.channelId}`);
  await expect(page.locator('textarea[placeholder*="mesaj"]').first()).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await page.waitForTimeout(3_000);
  const text = `e2e kopma ${Date.now()}`;
  await sendMessage(ch!.channelId, text); // test sürecinden — tarayıcı çevrimdışı
  await page.waitForTimeout(1_500);
  await context.setOffline(false);
  // Sayfa yenilenmeden gelmeli
  await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 25_000 });
});

test('sekme gizlenip geri gelince bağlantı sürer', async ({ page }) => {
  await page.goto(`/channels/${ch!.guildId}/${ch!.channelId}`);
  await expect(page.locator('textarea[placeholder*="mesaj"]').first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const text = `e2e görünürlük ${Date.now()}`;
  await sendMessage(ch!.channelId, text);
  await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 15_000 });
});
