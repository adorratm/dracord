import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * G2 — mobile data saver: images load on tap, link previews skip their pictures,
 * incoming video in calls drops to the lowest layer and the mic sends at a lower
 * bitrate. A manual switch (detecting cellular needs a native module, which would
 * break over-the-air updates).
 */
const KEY = 'dracord.data-saver.v1';
let on = false;
let loaded = false;
const listeners = new Set<() => void>();

void AsyncStorage.getItem(KEY)
  .then((v) => {
    on = v === '1';
    loaded = true;
    listeners.forEach((l) => l());
  })
  .catch(() => {
    loaded = true;
  });

export function isDataSaverOn(): boolean {
  return on;
}

export function setDataSaver(next: boolean): void {
  on = next;
  loaded = true;
  void AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => undefined);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDataSaver(): boolean {
  return useSyncExternalStore(subscribe, () => on, () => false);
}

export const dataSaverLoaded = (): boolean => loaded;
/** mic bitrate while data saver is on (speech stays clear at 24 kbps Opus) */
export const DATA_SAVER_AUDIO_BITRATE = 24_000;
