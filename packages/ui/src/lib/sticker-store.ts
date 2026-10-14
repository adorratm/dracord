/** Client-side sticker library + isteğe bağlı bulut senkronu (ClientSettings). */

export type StickerKind = 'emoji' | 'image';

export interface StoredSticker {
  id: string;
  kind: StickerKind;
  /** emoji glyph or image data URL / remote URL */
  value: string;
  label: string;
  contentType?: string;
  createdAt: number;
}

export type StickerCloudState = {
  custom: StoredSticker[];
  favoriteIds: string[];
  recentIds: string[];
};

const CUSTOM_KEY = 'dracord:stickers:custom';
const FAVORITES_KEY = 'dracord:stickers:favorites';
const RECENT_KEY = 'dracord:stickers:recent';
const MAX_CUSTOM = 40;
const MAX_RECENT = 24;
const MAX_FILE_BYTES = 3_000_000;

type CloudBridge = {
  get: () => Promise<StickerCloudState | null>;
  set: (state: StickerCloudState) => Promise<void>;
};

let cloudBridge: CloudBridge | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
/** React Native / SSR — localStorage yoksa bellek */
let memCustom: StoredSticker[] = [];
let memFavorites: string[] = [];
let memRecent: string[] = [];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

export function loadCustomStickers(): StoredSticker[] {
  if (!canUseLocalStorage()) return memCustom;
  return safeParse<StoredSticker[]>(localStorage.getItem(CUSTOM_KEY), []);
}

export function saveCustomStickers(list: StoredSticker[]) {
  const next = list.slice(0, MAX_CUSTOM);
  memCustom = next;
  if (canUseLocalStorage()) {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  }
  scheduleCloudPush();
}

export function loadFavoriteIds(): string[] {
  if (!canUseLocalStorage()) return memFavorites;
  return safeParse<string[]>(localStorage.getItem(FAVORITES_KEY), []);
}

export function saveFavoriteIds(ids: string[]) {
  memFavorites = ids;
  if (canUseLocalStorage()) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  }
  scheduleCloudPush();
}

export function loadRecentIds(): string[] {
  if (!canUseLocalStorage()) return memRecent;
  return safeParse<string[]>(localStorage.getItem(RECENT_KEY), []);
}

export function saveRecentIds(ids: string[]) {
  const next = ids.slice(0, MAX_RECENT);
  memRecent = next;
  if (canUseLocalStorage()) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }
  scheduleCloudPush();
}

export function toggleFavoriteId(id: string): string[] {
  const current = loadFavoriteIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [id, ...current];
  saveFavoriteIds(next);
  return next;
}

export function pushRecentId(id: string): string[] {
  const next = [id, ...loadRecentIds().filter((x) => x !== id)].slice(0, MAX_RECENT);
  saveRecentIds(next);
  return next;
}

export function addCustomSticker(sticker: Omit<StoredSticker, 'id' | 'createdAt'>): StoredSticker {
  const item: StoredSticker = {
    ...sticker,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const list = [item, ...loadCustomStickers()].slice(0, MAX_CUSTOM);
  saveCustomStickers(list);
  return item;
}

export function removeCustomSticker(id: string) {
  saveCustomStickers(loadCustomStickers().filter((s) => s.id !== id));
  saveFavoriteIds(loadFavoriteIds().filter((x) => x !== id));
  saveRecentIds(loadRecentIds().filter((x) => x !== id));
}

export function snapshotStickers(): StickerCloudState {
  return {
    custom: loadCustomStickers(),
    favoriteIds: loadFavoriteIds(),
    recentIds: loadRecentIds(),
  };
}

/** Yerel + uzak birleştir (id’ye göre; daha yeni createdAt kazanır) */
export function applyStickerCloudState(remote: StickerCloudState | null | undefined) {
  if (!remote) return;
  const localCustom = loadCustomStickers();
  const byId = new Map<string, StoredSticker>();
  for (const s of localCustom) byId.set(s.id, s);
  for (const s of remote.custom ?? []) {
    const prev = byId.get(s.id);
    if (!prev || (s.createdAt ?? 0) >= (prev.createdAt ?? 0)) byId.set(s.id, s);
  }
  const mergedCustom = [...byId.values()]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, MAX_CUSTOM);
  memCustom = mergedCustom;
  if (canUseLocalStorage()) {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(mergedCustom));
  }

  const fav = Array.from(
    new Set([...(remote.favoriteIds ?? []), ...loadFavoriteIds()]),
  );
  memFavorites = fav;
  if (canUseLocalStorage()) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(fav));
  }

  const recent = Array.from(
    new Set([...(remote.recentIds ?? []), ...loadRecentIds()]),
  ).slice(0, MAX_RECENT);
  memRecent = recent;
  if (canUseLocalStorage()) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }
}

function scheduleCloudPush() {
  if (!cloudBridge) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void cloudBridge?.set(snapshotStickers()).catch(() => undefined);
  }, 400);
}

/** Web / desktop / mobil Auth sonrası bağla */
export function setStickerCloudBridge(bridge: CloudBridge | null) {
  cloudBridge = bridge;
}

export async function pullStickersFromCloud(): Promise<void> {
  if (!cloudBridge) return;
  try {
    const remote = await cloudBridge.get();
    applyStickerCloudState(remote);
    // Yerelde yeni sticker varsa uzakla birleştirip geri yaz
    await cloudBridge.set(snapshotStickers());
  } catch {
    /* ignore */
  }
}

export function readImageFileAsSticker(file: File): Promise<Omit<StoredSticker, 'id' | 'createdAt'>> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Yalnızca görsel veya GIF seçilebilir'));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      reject(new Error('Dosya 3 MB’dan küçük olmalı'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? '');
      if (!value.startsWith('data:')) {
        reject(new Error('Dosya okunamadı'));
        return;
      }
      resolve({
        kind: 'image',
        value,
        label: file.name.replace(/\.[^.]+$/, '') || 'Sticker',
        contentType: file.type,
      });
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.includes('gif')
    ? 'gif'
    : blob.type.includes('png')
      ? 'png'
      : blob.type.includes('webp')
        ? 'webp'
        : 'jpg';
  return new File([blob], filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`, {
    type: blob.type || 'image/png',
  });
}
