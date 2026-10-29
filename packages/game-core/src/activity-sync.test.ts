import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityCasCheck,
  activityNextVersion,
  billiardsValidateShotPatch,
} from './activity-sync';

describe('activityCasCheck', () => {
  it('allows missing expected when enforce off', () => {
    assert.equal(activityCasCheck(3, undefined, false), 'ok');
  });

  it('requires expected when enforce on', () => {
    assert.equal(activityCasCheck(3, undefined, true), 'missing');
  });

  it('detects conflict', () => {
    assert.equal(activityCasCheck(3, 2, false), 'conflict');
    assert.equal(activityCasCheck(3, 3, true), 'ok');
  });
});

describe('activityNextVersion', () => {
  it('increments from zero', () => {
    assert.equal(activityNextVersion(0), 1);
    assert.equal(activityNextVersion(41), 42);
  });
});

describe('billiardsValidateShotPatch', () => {
  const players = ['u1', 'u2'];

  it('accepts turn owner shot', () => {
    const r = billiardsValidateShotPatch(
      { dx: 1, dz: 0, power: 0.5, by: 'u1', id: 100 },
      { userId: 'u1', playerIds: players, turn: 0, prevShot: null },
    );
    assert.equal(r.ok, true);
  });

  it('rejects wrong turn', () => {
    const r = billiardsValidateShotPatch(
      { dx: 1, dz: 0, power: 0.5, by: 'u2', id: 100 },
      { userId: 'u2', playerIds: players, turn: 0, prevShot: null },
    );
    assert.equal(r.ok, false);
  });

  it('rejects non-monotonic shot id', () => {
    const r = billiardsValidateShotPatch(
      { dx: 1, dz: 0, power: 0.5, by: 'u1', id: 50 },
      {
        userId: 'u1',
        playerIds: players,
        turn: 0,
        prevShot: { dx: 1, dz: 0, power: 0.4, by: 'u1', id: 100 },
      },
    );
    assert.equal(r.ok, false);
  });
});
