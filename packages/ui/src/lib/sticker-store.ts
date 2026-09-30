/** Client-side sticker library: custom uploads, favorites, recently used. */

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

const CUSTOM_KEY = 'dracord:stickers:custom';
const FAVORITES_KEY = 'dracord:stickers:favorites';
const RECENT_KEY = 'dracord:stickers:recent';
const MAX_CUSTOM = 40;
const MAX_RECENT = 24;
const MAX_FILE_BYTES = 3_000_000;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadCustomStickers(): StoredSticker[] {
  if (typeof window === 'undefined') return [];
  return safeParse<StoredSticker[]>(localStorage.getItem(CUSTOM_KEY), []);
}

export function saveCustomStickers(list: StoredSticker[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.slice(0, MAX_CUSTOM)));
}

export function loadFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  return safeParse<string[]>(localStorage.getItem(FAVORITES_KEY), []);
}

export function saveFavoriteIds(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

export function loadRecentIds(): string[] {
  if (typeof window === 'undefined') return [];
  return safeParse<string[]>(localStorage.getItem(RECENT_KEY), []);
}

export function saveRecentIds(ids: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
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
