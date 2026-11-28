import { afterEach, describe, expect, it, vi } from 'vitest';
import { screenShareErrorMessage, stripIpcErrorPrefix } from './screen-share';

describe('stripIpcErrorPrefix', () => {
  it('removes the Electron IPC prefix', () => {
    expect(
      stripIpcErrorPrefix("Error invoking remote method 'desktop-capturer:get-sources': Error: macOS ekran kaydı izni yok."),
    ).toBe('macOS ekran kaydı izni yok.');
  });

  it('leaves plain messages untouched', () => {
    expect(stripIpcErrorPrefix('boom')).toBe('boom');
  });
});

describe('screenShareErrorMessage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('points Mac users to the screen recording setting when the system blocks capture', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mac' });
    const err = new DOMException('Permission denied by system', 'NotAllowedError');
    expect(screenShareErrorMessage(err)).toMatch(/Ekran ve Sistem Sesi Kaydı/);
  });

  it('maps a failed source listing on Mac to the permission hint', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mac' });
    const err = new Error("Error invoking remote method 'desktop-capturer:get-sources': Error: Failed to get sources.");
    expect(screenShareErrorMessage(err)).toMatch(/Ekran ve Sistem Sesi Kaydı/);
  });

  it('still reports a user cancel as a cancel', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Windows' });
    const err = new DOMException('Permission denied', 'NotAllowedError');
    expect(screenShareErrorMessage(err)).toMatch(/iptal edildi/);
  });
});
