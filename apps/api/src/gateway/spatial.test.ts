import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSpatial, spatialGain, SPATIAL_FAR, SPATIAL_NEAR } from '@dracord/types';

test('spatial gain falls off smoothly with distance', () => {
  const a = { x: 0.5, y: 0.5 };
  assert.equal(spatialGain(a, { x: 0.5 + SPATIAL_NEAR * 0.9, y: 0.5 }), 1);
  assert.equal(spatialGain(a, { x: 0.5 + SPATIAL_FAR + 0.01, y: 0.5 }), 0);
  const mid = spatialGain(a, { x: 0.5 + (SPATIAL_NEAR + SPATIAL_FAR) / 2, y: 0.5 });
  assert.ok(mid > 0.3 && mid < 0.7, `mid=${mid}`);
});

test('sanitizeSpatial clamps and rejects junk', () => {
  assert.deepEqual(sanitizeSpatial({ guildId: 'g', channelId: 'c', x: 2, y: -1 }), { guildId: 'g', channelId: 'c', x: 1, y: 0 });
  assert.deepEqual(sanitizeSpatial({ guildId: 'g', channelId: 'c', x: null, y: null }), { guildId: 'g', channelId: 'c', x: null, y: null });
  assert.equal(sanitizeSpatial({ guildId: 'g', channelId: 'c', x: 'a', y: 1 }), null);
  assert.equal(sanitizeSpatial({ channelId: 'c', x: 0, y: 0 }), null);
});
