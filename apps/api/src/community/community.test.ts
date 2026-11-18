import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawWinners, istanbulNow, normalizeBirthday } from './community.service';

test('draw picks distinct winners and never more than the entrants', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];
  for (let i = 0; i < 200; i++) {
    const w = drawWinners(pool, 3);
    assert.equal(w.length, 3);
    assert.equal(new Set(w).size, 3);
    assert.ok(w.every((x) => pool.includes(x)));
  }
  assert.deepEqual(drawWinners(['a', 'a', 'b'], 5).sort(), ['a', 'b']);
  assert.deepEqual(drawWinners([], 2), []);
});

test('draw is uniform enough', () => {
  const hits: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 8000; i++) hits[drawWinners(['a', 'b', 'c', 'd'], 1)[0]!]!++;
  for (const v of Object.values(hits)) assert.ok(v > 1700 && v < 2300, String(v));
});

test('birthday is MM-DD with a real day', () => {
  assert.equal(normalizeBirthday('04-23'), '04-23');
  assert.equal(normalizeBirthday('02-29'), '02-29');
  assert.equal(normalizeBirthday('02-30'), null);
  assert.equal(normalizeBirthday('13-01'), null);
  assert.equal(normalizeBirthday('4-23'), null);
  assert.equal(normalizeBirthday(42), null);
});

test('istanbul day boundary', () => {
  // 21:30 UTC on 31 Dec = 00:30 on 1 Jan in Istanbul (UTC+3)
  const t = istanbulNow(new Date('2026-12-31T21:30:00Z'));
  assert.equal(t.day, '2027-01-01');
  assert.equal(t.md, '01-01');
  assert.equal(t.hour, 0);
});
