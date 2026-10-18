/** Steam kütüphane kapağı — üye listesinde object-cover ile kare kırpılır */
function steamLibraryArt(steamAppId: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`;
}

export type DesktopGameEntry = {
  name: string;
  /** Kapak / logo URL (yoksa istemci generic ikon gösterir) */
  imageUrl: string | null;
};

/**
 * Masaüstü process allowlist (exe küçük harf → görünen ad + görsel).
 * Electron `presence:detect-games` ile senkron tutulmalı.
 */
export const DESKTOP_GAME_BY_APP_ID: Record<string, DesktopGameEntry> = {
  'league of legends.exe': {
    name: 'League of Legends',
    imageUrl: null,
  },
  'valorant.exe': {
    name: 'VALORANT',
    imageUrl: null,
  },
  'cs2.exe': { name: 'Counter-Strike 2', imageUrl: steamLibraryArt(730) },
  'csgo.exe': { name: 'Counter-Strike', imageUrl: steamLibraryArt(730) },
  'fortniteclient-win64-shipping.exe': {
    name: 'Fortnite',
    imageUrl: null,
  },
  'gta5.exe': {
    name: 'Grand Theft Auto V',
    imageUrl: steamLibraryArt(271590),
  },
  'rdr2.exe': {
    name: 'Red Dead Redemption 2',
    imageUrl: steamLibraryArt(1174180),
  },
  'minecraft.exe': {
    name: 'Minecraft',
    imageUrl: null,
  },
  'javaw.exe': {
    name: 'Minecraft',
    imageUrl: null,
  },
  'rocketleague.exe': {
    name: 'Rocket League',
    imageUrl: steamLibraryArt(252950),
  },
  'overwatch.exe': {
    name: 'Overwatch 2',
    imageUrl: null,
  },
  'dota2.exe': { name: 'Dota 2', imageUrl: steamLibraryArt(570) },
  'apex_legends.exe': {
    name: 'Apex Legends',
    imageUrl: steamLibraryArt(1172470),
  },
  'r5apex.exe': {
    name: 'Apex Legends',
    imageUrl: steamLibraryArt(1172470),
  },
  'wow.exe': {
    name: 'World of Warcraft',
    imageUrl: null,
  },
};

export function desktopGameImageUrl(appId?: string | null): string | null {
  if (!appId) return null;
  return DESKTOP_GAME_BY_APP_ID[appId.toLowerCase()]?.imageUrl ?? null;
}

export function desktopGameName(appId?: string | null): string | null {
  if (!appId) return null;
  return DESKTOP_GAME_BY_APP_ID[appId.toLowerCase()]?.name ?? null;
}
