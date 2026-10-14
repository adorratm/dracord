import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClientSettings } from '@dracord/types';
import type { DracordClient } from '@dracord/sdk';

export type MobileSticker = {
  id: string;
  kind: 'emoji' | 'image';
  value: string;
  label: string;
  contentType?: string;
  createdAt: number;
};

type StickerState = {
  custom: MobileSticker[];
  favoriteIds: string[];
  recentIds: string[];
};

const KEY = 'dracord:stickers:v1';
const MAX_CUSTOM = 40;

let memory: StickerState = { custom: [], favoriteIds: [], recentIds: [] };

export function getLocalStickers(): MobileSticker[] {
  return memory.custom;
}

export async function loadStickersFromDisk(): Promise<StickerState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return memory;
    memory = JSON.parse(raw) as StickerState;
    return memory;
  } catch {
    return memory;
  }
}

async function saveLocal(state: StickerState) {
  memory = {
    custom: (state.custom ?? []).slice(0, MAX_CUSTOM),
    favoriteIds: state.favoriteIds ?? [],
    recentIds: (state.recentIds ?? []).slice(0, 24),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(memory));
}

function mergeStates(local: StickerState, remote: StickerState | null | undefined): StickerState {
  if (!remote) return local;
  const byId = new Map<string, MobileSticker>();
  for (const s of local.custom ?? []) byId.set(s.id, s);
  for (const s of remote.custom ?? []) {
    const prev = byId.get(s.id);
    if (!prev || (s.createdAt ?? 0) >= (prev.createdAt ?? 0)) byId.set(s.id, s);
  }
  return {
    custom: [...byId.values()]
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, MAX_CUSTOM),
    favoriteIds: Array.from(
      new Set([...(remote.favoriteIds ?? []), ...(local.favoriteIds ?? [])]),
    ),
    recentIds: Array.from(
      new Set([...(remote.recentIds ?? []), ...(local.recentIds ?? [])]),
    ).slice(0, 24),
  };
}

/** Giriş sonrası: buluttan çek, yerelle birleştir, geri yaz */
export async function syncStickersWithCloud(client: DracordClient): Promise<MobileSticker[]> {
  await loadStickersFromDisk();
  try {
    const remote = await client.getClientSettings();
    const remoteStickers = (remote as Partial<ClientSettings>)?.stickers as
      | StickerState
      | undefined;
    const merged = mergeStates(memory, remoteStickers);
    await saveLocal(merged);
    await client.updateClientSettings({ stickers: merged });
  } catch {
    /* çevrimdışı / hata — yerel yeterli */
  }
  return memory.custom;
}
