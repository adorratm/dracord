import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Herkese açık sayfalarda WCAG 2 A/AA taraması — koyu ve açık tema. Ciddi/kritik ihlal testi düşürür. */
for (const path of ['/', '/login', '/download']) {
  for (const scheme of ['dark', 'light'] as const) {
    test(`erişilebilirlik ${path} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      const report = serious
        .map((v) => `${v.id} (${v.nodes.length}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`)
        .join('\n');
      expect(serious, report).toEqual([]);
    });
  }
}
