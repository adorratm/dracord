import { useCallback, useEffect, useState } from 'react';
import {
  CAMERA_BG_EVENT,
  CAMERA_BG_KEY,
  loadCameraBackground,
  normalizeCameraBackground,
  saveCameraBackground,
  type CameraBackgroundSettings,
} from './camera-background';

/** A10 — camera background setting, live across components and tabs */
export function useCameraBackground(): [CameraBackgroundSettings, (patch: Partial<CameraBackgroundSettings>) => void] {
  const [s, setS] = useState<CameraBackgroundSettings>(() => loadCameraBackground());
  useEffect(() => {
    const onLocal = (e: Event) => setS(normalizeCameraBackground((e as CustomEvent).detail));
    const onStorage = (e: StorageEvent) => {
      if (e.key === CAMERA_BG_KEY) setS(loadCameraBackground());
    };
    window.addEventListener(CAMERA_BG_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CAMERA_BG_EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const update = useCallback((patch: Partial<CameraBackgroundSettings>) => {
    setS((prev) => {
      const next = normalizeCameraBackground({ ...prev, ...patch });
      saveCameraBackground(next);
      return next;
    });
  }, []);
  return [s, update];
}
