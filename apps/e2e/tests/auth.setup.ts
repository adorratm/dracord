import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import { API_URL, AUTH_DIR, BASE_URL, STATE_FILE, saveTokens, savedRefreshToken } from '../fixtures/env';

/**
 * Giriş yalnız OAuth (Google/Apple) ve passkey ile olduğu için form doldurulmaz:
 * test hesabının yenileme belirteciyle yeni belirteç alınır ve web'in localStorage anahtarlarına yazılır.
 */
setup('oturum hazırla', async () => {
  const refresh = savedRefreshToken();
  setup.skip(!refresh, 'E2E_REFRESH_TOKEN yok — oturum gerektiren testler atlanır');

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  // CI'da gizli belirteç ilk kullanımdan sonra eskir — kırmızıya düşürme, oturumlu testleri atla
  setup.skip(!res.ok && Boolean(process.env.CI), `yenileme başarısız (${res.status}) — E2E_REFRESH_TOKEN secret'ını yenile`);
  expect(res.ok, `yenileme başarısız (${res.status}) — yeni bir E2E_REFRESH_TOKEN ver`).toBeTruthy();
  const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
  saveTokens(tokens.accessToken, tokens.refreshToken);

  const meRes = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
  expect(meRes.ok).toBeTruthy();
  const user = await meRes.json();

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            { name: 'dracord_access_token', value: tokens.accessToken },
            { name: 'dracord_refresh_token', value: tokens.refreshToken },
            { name: 'dracord_user', value: JSON.stringify(user) },
            // Tanıtım turu testleri bölmesin
            { name: 'dracord:app-tour-v2', value: 'done' },
          ],
        },
      ],
    }),
    { mode: 0o600 },
  );
});
