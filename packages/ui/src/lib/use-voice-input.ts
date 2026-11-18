import { useCallback, useEffect, useState } from 'react';
import {
  VOICE_INPUT_EVENT,
  VOICE_INPUT_STORAGE_KEY,
  loadVoiceInput,
  normalizeVoiceInput,
  saveVoiceInput,
  type VoiceInputSettings,
} from './voice-input';

/** A8 — the voice input settings (web / desktop, localStorage), live across components and tabs. */
export function useVoiceInputSettings(): [VoiceInputSettings, (patch: Partial<VoiceInputSettings>) => void] {
  const [settings, setSettings] = useState<VoiceInputSettings>(() => loadVoiceInput());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onLocal = (e: Event) => setSettings(normalizeVoiceInput((e as CustomEvent).detail));
    const onStorage = (e: StorageEvent) => {
      if (e.key === VOICE_INPUT_STORAGE_KEY) setSettings(loadVoiceInput());
    };
    window.addEventListener(VOICE_INPUT_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(VOICE_INPUT_EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const update = useCallback((patch: Partial<VoiceInputSettings>) => {
    setSettings((prev) => {
      const next = normalizeVoiceInput({ ...prev, ...patch });
      saveVoiceInput(next);
      return next;
    });
  }, []);
  return [settings, update];
}
