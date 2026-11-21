import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hasSession, testChannel } from '../fixtures/env';

/**
 * Oturumlu ekranlarda erişilebilirlik taraması (koyu + açık tema): kanal, ayarlar, arkadaşlar.
 * Kritik ihlal testi düşürür; ciddi olanlar rapora yazılır (kademeli düzeltme için).
 */
const ch = testChannel();
const pages: Array<{ name: string; path: () => string }> = [
  { name: 'kanal', path: () => `/channels/${ch!.guildId}/${ch!.channelId}` },
  { name: 'ayarlar', path: () => '/settings' },
  { name: 'arkadaşlar', path: () => '/channels/@me' },
];

test.beforeAll(() => {
  test.skip(!hasSession() || !ch, 'E2E_REFRESH_TOKEN / E2E_CHANNEL yok');
});

for (const p of pages) {
  for (const scheme of ['dark', 'light'] as const) {
    test(`erişilebilirlik ${p.name} (${scheme})`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(p.path());
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const fmt = (impact: string) =>
        r.violations
          .filter((v) => v.impact === impact)
          .map((v) => `${v.id} (${v.nodes.length}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`)
          .join('\n');
      const serious = fmt('serious');
      if (serious) await info.attach(`ciddi-${p.name}-${scheme}.txt`, { body: serious, contentType: 'text/plain' });
      const critical = r.violations.filter((v) => v.impact === 'critical');
      expect(critical, fmt('critical')).toEqual([]);
    });
  }
}
