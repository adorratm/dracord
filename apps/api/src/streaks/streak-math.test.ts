import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { advance, dayKey, liveCurrent, nextMilestone, streakTier, type StreakState } from './streak-math';

const base: StreakState = { current: 0, best: 0, lastDay: null, freezes: 0, freezesUsed: 0 };

describe('streak math', () => {
  it('uses the Istanbul day boundary', () => {
    assert.equal(dayKey(new Date('2026-11-26T20:59:00Z')), '2026-11-26');
    assert.equal(dayKey(new Date('2026-11-26T21:01:00Z')), '2026-11-27');
  });

  it('starts at 1 and ignores repeats on the same day', () => {
    const a = advance(base, '2026-11-01');
    assert.equal(a.current, 1);
    assert.equal(advance(a, '2026-11-01').current, 1);
  });

  it('grows on consecutive days and earns a freeze every 7 days', () => {
    let s: StreakState = base;
    for (let d = 1; d <= 7; d++) s = advance(s, `2026-11-0${d}`);
    assert.equal(s.current, 7);
    assert.equal(s.freezes, 1);
  });

  it('spends freezes to cover missed days, else resets', () => {
    const s: StreakState = { current: 10, best: 10, lastDay: '2026-11-10', freezes: 1, freezesUsed: 0 };
    const saved = advance(s, '2026-11-12');
    assert.equal(saved.current, 11);
    assert.equal(saved.freezes, 0);
    assert.equal(advance(s, '2026-11-13').current, 1);
    assert.equal(advance(s, '2026-11-13').best, 10);
  });

  it('reports milestones, live value and tiers', () => {
    assert.equal(advance({ ...base, current: 2, lastDay: '2026-11-01' }, '2026-11-02').milestone, 3);
    assert.equal(liveCurrent({ ...base, current: 5, lastDay: '2026-11-01' }, '2026-11-04'), 0);
    assert.equal(liveCurrent({ ...base, current: 5, lastDay: '2026-11-01' }, '2026-11-02'), 5);
    assert.equal(nextMilestone(7), 14);
    assert.equal(streakTier(40), 30);
    assert.equal(streakTier(2), null);
  });
});
