import { test, expect, type Page } from '@playwright/test';
import { cleanup, me } from '../fixtures/api';
import { hasSession, testChannel } from '../fixtures/env';

/**
 * Oturumlu sohbet duman testleri. E2E_CHANNEL'daki kanala yazar ve sonunda kendi mesajlarını siler —
 * gerçek bir kanala değil, test sunucusundaki bir kanala yönlendir.
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

function composer(page: Page) {
  return page.locator('textarea[placeholder*="mesaj"]').first();
}

async function openChannel(page: Page) {
  await page.goto(`/channels/${ch!.guildId}/${ch!.channelId}`);
  await expect(composer(page)).toBeVisible({ timeout: 20_000 });
}

/** 96×64 düz renkli PNG (canvas ile üretilir) */
async function pasteScreenshot(page: Page) {
  await composer(page).click();
  await composer(page).evaluate(async (el) => {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#bd93f9';
    g.fillRect(0, 0, 96, 64);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'image.png', { type: 'image/png' }));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
}

test('mesaj gönder ve listede gör', async ({ page }) => {
  await openChannel(page);
  const text = `e2e duman ${Date.now()}`;
  await composer(page).fill(text);
  await composer(page).press('Enter');
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect(composer(page)).toHaveValue('');
});

test('Ctrl+V ile ekran görüntüsü doğrudan yüklenir', async ({ page }) => {
  await openChannel(page);
  await pasteScreenshot(page);
  const img = page.locator('img[alt^="ekran-goruntusu-"]').last();
  await expect(img).toBeVisible({ timeout: 20_000 });
  // Metin yapıştırılmadı
  await expect(composer(page)).toHaveValue('');
});

test('görsel önizlemesi tam ekran açılır, Esc ile kapanır', async ({ page }) => {
  await openChannel(page);
  let img = page.locator('img[alt^="ekran-goruntusu-"]').last();
  if (!(await img.isVisible().catch(() => false))) {
    await pasteScreenshot(page);
    img = page.locator('img[alt^="ekran-goruntusu-"]').last();
    await expect(img).toBeVisible({ timeout: 20_000 });
  }
  await img.click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  // Gerileme: önizleme mesaj satırına hapsolmamalı — görüntü alanının tamamını kaplamalı
  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBeGreaterThanOrEqual(vp.width - 2);
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(vp.height - 2);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
