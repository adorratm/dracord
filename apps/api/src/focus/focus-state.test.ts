import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusStateAt } from '@dracord/types';
const s = { startedAt: '2026-01-01T00:00:00Z', focusMin: 25, breakMin: 5, longBreakMin: 15, longEvery: 4 };
const t0 = Date.parse(s.startedAt), m = 60_000;
test('phases', () => {
  assert.equal(focusStateAt({ ...s, startedAt: null }, t0).phase, 'idle');
  assert.deepEqual(focusStateAt(s, t0 + 10 * m), { phase: 'focus', round: 1, endsAt: t0 + 25 * m, lengthMs: 25 * m });
  assert.equal(focusStateAt(s, t0 + 26 * m).phase, 'break');
  assert.equal(focusStateAt(s, t0 + 31 * m).round, 2);
  // 4 tur sonrası uzun mola: 4*25 + 3*5 = 115 dk
  assert.equal(focusStateAt(s, t0 + 116 * m).phase, 'long');
  // döngü 130 dk: 131. dk 5. tur odak
  const r = focusStateAt(s, t0 + 131 * m);
  assert.equal(r.phase, 'focus'); assert.equal(r.round, 5);
});
