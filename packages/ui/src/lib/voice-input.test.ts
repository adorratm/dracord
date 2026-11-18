import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VOICE_INPUT,
  bindingFromKey,
  formatBinding,
  matchesBinding,
  normalizeVoiceInput,
  releasesBinding,
  shouldTransmit,
  toElectronAccelerator,
  toWindowsVks,
} from './voice-input';

const ev = (code: string, m: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}) => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...m,
});

test('push-to-talk transmits only while held and not muted', () => {
  assert.equal(shouldTransmit({ mode: 'voice' }, { muted: false, pttHeld: false }), true);
  assert.equal(shouldTransmit({ mode: 'ptt' }, { muted: false, pttHeld: false }), false);
  assert.equal(shouldTransmit({ mode: 'ptt' }, { muted: false, pttHeld: true }), true);
  assert.equal(shouldTransmit({ mode: 'ptt' }, { muted: true, pttHeld: true }), false);
});

test('a combination matches only with the same modifiers', () => {
  const b = { code: 'KeyM', ctrl: true, shift: true };
  assert.equal(matchesBinding(b, ev('KeyM', { ctrlKey: true, shiftKey: true })), true);
  assert.equal(matchesBinding(b, ev('KeyM', { ctrlKey: true })), false);
  assert.equal(matchesBinding(b, ev('KeyN', { ctrlKey: true, shiftKey: true })), false);
});

test('a lone modifier push-to-talk key ignores the other modifiers', () => {
  const b = bindingFromKey(ev('ControlLeft', { ctrlKey: true }));
  assert.deepEqual(b, { code: 'ControlLeft' });
  assert.equal(matchesBinding(b, ev('ControlLeft', { ctrlKey: true, shiftKey: true })), true);
  assert.equal(releasesBinding(b, { code: 'ControlLeft' }), true);
});

test('mouse side buttons bind and release', () => {
  const b = { code: '', mouse: 3 };
  assert.equal(matchesBinding(b, { button: 3, ...ev('') }), true);
  assert.equal(releasesBinding(b, { button: 3 }), true);
  assert.equal(formatBinding(b), 'Fare 4');
  assert.deepEqual(toWindowsVks(b), [0x05]);
  assert.equal(toElectronAccelerator(b), null);
});

test('electron accelerator and windows virtual keys', () => {
  assert.equal(toElectronAccelerator({ code: 'KeyM', ctrl: true, shift: true }), 'CommandOrControl+Shift+M');
  assert.equal(toElectronAccelerator({ code: 'F13' }), 'F13');
  assert.equal(toElectronAccelerator({ code: 'ControlLeft' }), null);
  assert.deepEqual(toWindowsVks({ code: 'KeyV' }), [0x56]);
  assert.deepEqual(toWindowsVks({ code: 'F1' }), [0x70]);
  assert.deepEqual(toWindowsVks({ code: 'Backquote', ctrl: true }), [0xc0, 0x11]);
  assert.deepEqual(toWindowsVks({ code: 'ControlLeft' }), [0xa2]);
});

test('stored settings are normalised (bad values fall back)', () => {
  assert.deepEqual(normalizeVoiceInput(null), DEFAULT_VOICE_INPUT);
  const n = normalizeVoiceInput({ mode: 'ptt', pttKey: { code: 'KeyV' }, pttReleaseMs: 99999, muteKey: null });
  assert.equal(n.mode, 'ptt');
  assert.equal(n.pttKey?.code, 'KeyV');
  assert.equal(n.pttReleaseMs, 1500);
  assert.equal(n.muteKey, null);
  assert.deepEqual(n.deafenKey, DEFAULT_VOICE_INPUT.deafenKey);
  assert.equal(normalizeVoiceInput({ pttKey: { mouse: 0 } }).pttKey, null);
});
