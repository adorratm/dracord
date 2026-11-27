import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeRc, encodeRc, rcCanDirect, rcSend, sanitizeRcInput, RC_TOPIC, type RcRoomLike } from './remote-control-rtc';

test('sanitizer clamps coordinates and rejects junk', () => {
  assert.deepEqual(sanitizeRcInput({ type: 'move', nx: 1.4, ny: -2 }), { type: 'move', nx: 1, ny: 0 });
  assert.deepEqual(sanitizeRcInput({ type: 'down', nx: 0.5, ny: 0.5, button: 9 }), { type: 'down', nx: 0.5, ny: 0.5, button: 0 });
  assert.equal(sanitizeRcInput({ type: 'exec', cmd: 'rm' }), null);
  assert.equal(sanitizeRcInput({ type: 'move', nx: 'a', ny: 1 }), null);
  assert.equal(sanitizeRcInput({ type: 'key', keyAction: 'press', code: 'KeyA' }), null);
  assert.equal(sanitizeRcInput({ type: 'key', keyAction: 'down', code: 'x'.repeat(100) }), null);
  assert.deepEqual(sanitizeRcInput({ type: 'wheel', deltaY: 1e9 }), { type: 'wheel', deltaY: 2000 });
  const k = sanitizeRcInput({ type: 'key', keyAction: 'down', code: 'KeyC', key: 'c', ctrl: true, alt: 'yes' });
  assert.deepEqual(k, { type: 'key', keyAction: 'down', code: 'KeyC', key: 'c', ctrl: true, alt: undefined, shift: undefined, meta: undefined });
});

test('encode/decode round trip, oversized and foreign messages dropped', () => {
  const m = decodeRc(encodeRc({ v: 1, k: 'in', p: { type: 'move', nx: 0.25, ny: 0.75 } }));
  assert.deepEqual(m, { v: 1, k: 'in', p: { type: 'move', nx: 0.25, ny: 0.75 } });
  assert.deepEqual(decodeRc(encodeRc({ v: 1, k: 'ping', id: 7 })), { v: 1, k: 'ping', id: 7 });
  assert.equal(decodeRc(new TextEncoder().encode('{"v":2,"k":"in"}')), null);
  assert.equal(decodeRc(new Uint8Array(2048)), null);
  assert.equal(decodeRc(new TextEncoder().encode('not json')), null);
});

test('direct path only when the sharer is in the room; moves are lossy, keys reliable', () => {
  const sent: Array<{ reliable?: boolean; to?: string[]; topic?: string }> = [];
  const room: RcRoomLike = {
    localParticipant: { publishData: async (_d, o) => void sent.push({ reliable: o.reliable, to: o.destinationIdentities, topic: o.topic }) },
    remoteParticipants: new Map([['x', { identity: 'sharer1' }]]),
    on: () => undefined,
    off: () => undefined,
  };
  assert.equal(rcCanDirect(room, 'sharer1'), true);
  assert.equal(rcCanDirect(room, 'someone'), false);
  assert.equal(rcCanDirect(null, 'sharer1'), false);
  rcSend(room, 'sharer1', { v: 1, k: 'in', p: { type: 'move', nx: 0, ny: 0 } });
  rcSend(room, 'sharer1', { v: 1, k: 'in', p: { type: 'key', keyAction: 'down', code: 'KeyA' } });
  rcSend(room, 'sharer1', { v: 1, k: 'ping', id: 1 });
  assert.deepEqual(sent.map((s) => s.reliable), [false, true, false]);
  assert.ok(sent.every((s) => s.topic === RC_TOPIC && s.to?.[0] === 'sharer1'));
});

test('route: direct only after the sharer answers, back to server on silence', async () => {
  const { rcRoute } = await import('./remote-control-rtc');
  const t = 10_000;
  // eski sürüm paylaşan: hiç pong yok → sunucu
  assert.equal(rcRoute({ reachable: true, lastPongAt: 0, now: t, timeoutMs: 6000 }), 'server');
  // pong geldi → doğrudan
  assert.equal(rcRoute({ reachable: true, lastPongAt: t - 1000, now: t, timeoutMs: 6000 }), 'direct');
  // yanıt kesildi → sunucu
  assert.equal(rcRoute({ reachable: true, lastPongAt: t - 7000, now: t, timeoutMs: 6000 }), 'server');
  // paylaşan odada değil → sunucu
  assert.equal(rcRoute({ reachable: false, lastPongAt: t - 100, now: t, timeoutMs: 6000 }), 'server');
});

test('send failure triggers the fallback', async () => {
  let failed = 0;
  const room: RcRoomLike = {
    localParticipant: { publishData: async () => { throw new Error('dc closed'); } },
    remoteParticipants: new Map(),
    on: () => undefined,
    off: () => undefined,
  };
  rcSend(room, 's', { v: 1, k: 'in', p: { type: 'key', keyAction: 'down', code: 'KeyA' } }, () => failed++);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(failed, 1);
});
