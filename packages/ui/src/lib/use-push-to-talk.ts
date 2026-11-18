import { useEffect, useRef } from 'react';
import { matchesBinding, releasesBinding, type VoiceInputSettings } from './voice-input';

interface PushToTalkOptions {
  /** in a voice room right now */
  active: boolean;
  settings: VoiceInputSettings;
  /** push-to-talk opened / closed (after the release delay) */
  onHeldChange: (held: boolean) => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  /** held according to a source outside this window (desktop: the global key watcher) */
  externalHeld?: boolean;
  /** handle the mute / deafen hotkeys from this window's key events (off when the desktop app registers them globally) */
  windowHotkeys?: boolean;
}

let ctx: AudioContext | null = null;
/** two soft clicks: up for open, down for close */
function pttClick(open: boolean): void {
  try {
    const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(open ? 880 : 620, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.08);
  } catch {
    /* no audio */
  }
}

/**
 * A8 — push-to-talk from this window (key or mouse side button), plus the mute / deafen
 * hotkeys. The release delay keeps the microphone open a moment after the key is let go.
 */
export function usePushToTalk({ active, settings, onHeldChange, onToggleMute, onToggleDeafen, externalHeld = false, windowHotkeys = true }: PushToTalkOptions): void {
  const keyHeld = useRef(false);
  const extHeld = useRef(false);
  const reported = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef({ onHeldChange, onToggleMute, onToggleDeafen, settings });
  cb.current = { onHeldChange, onToggleMute, onToggleDeafen, settings };

  const evaluate = useRef(() => {
    const held = keyHeld.current || extHeld.current;
    const { settings: s, onHeldChange: report } = cb.current;
    if (held) {
      if (releaseTimer.current) {
        clearTimeout(releaseTimer.current);
        releaseTimer.current = null;
      }
      if (!reported.current) {
        reported.current = true;
        if (s.pttSounds) pttClick(true);
        report(true);
      }
      return;
    }
    if (!reported.current || releaseTimer.current) return;
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null;
      if (keyHeld.current || extHeld.current) return;
      reported.current = false;
      if (cb.current.settings.pttSounds) pttClick(false);
      cb.current.onHeldChange(false);
    }, Math.max(0, s.pttReleaseMs));
  });

  useEffect(() => {
    extHeld.current = externalHeld;
    evaluate.current();
  }, [externalHeld]);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const ptt = settings.mode === 'ptt' ? settings.pttKey : null;
    const onDown = (e: KeyboardEvent | MouseEvent) => {
      const isKey = 'code' in e;
      if (ptt && matchesBinding(ptt, { code: isKey ? e.code : undefined, button: isKey ? undefined : e.button, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey })) {
        if (!keyHeld.current) {
          keyHeld.current = true;
          evaluate.current();
        }
        return;
      }
      if (!isKey || !windowHotkeys || (e as KeyboardEvent).repeat) return;
      const ke = e as KeyboardEvent;
      if (matchesBinding(settings.muteKey, ke)) {
        ke.preventDefault();
        cb.current.onToggleMute?.();
      } else if (matchesBinding(settings.deafenKey, ke)) {
        ke.preventDefault();
        cb.current.onToggleDeafen?.();
      }
    };
    const onUp = (e: KeyboardEvent | MouseEvent) => {
      if (!ptt || !keyHeld.current) return;
      const isKey = 'code' in e;
      if (releasesBinding(ptt, { code: isKey ? e.code : undefined, button: isKey ? undefined : e.button })) {
        keyHeld.current = false;
        evaluate.current();
      }
    };
    // focus moved away mid-press: the key-up will never come here
    const onBlur = () => {
      if (!keyHeld.current) return;
      keyHeld.current = false;
      evaluate.current();
    };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mouseup', onUp, true);
      window.removeEventListener('blur', onBlur);
      keyHeld.current = false;
    };
  }, [active, settings.mode, settings.pttKey, settings.muteKey, settings.deafenKey, windowHotkeys]);

  // left the room: close
  useEffect(() => {
    if (active) return;
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
    keyHeld.current = false;
    if (reported.current) {
      reported.current = false;
      cb.current.onHeldChange(false);
    }
  }, [active]);
}
