/** Steam kütüphane kapağı — üye listesinde object-cover ile kare kırpılır */
function steamLibraryArt(steamAppId: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`;
}

function steamStoreUrl(steamAppId: number): string {
  return `https://store.steampowered.com/app/${steamAppId}`;
}

export type DesktopGameEntry = {
  name: string;
  /** Kapak / logo URL (yoksa istemci generic ikon gösterir) */
  imageUrl: string | null;
  /** Steam mağaza / store sayfası */
  url?: string | null;
  steamAppId?: number | null;
};

function steamEntry(name: string, steamAppId: number): DesktopGameEntry {
  return {
    name,
    steamAppId,
    imageUrl: steamLibraryArt(steamAppId),
    url: steamStoreUrl(steamAppId),
  };
}

/**
 * Masaüstü process allowlist (exe küçük harf → görünen ad + görsel).
 * Electron `presence:detect-games` ile senkron tutulmalı.
 */
export const DESKTOP_GAME_BY_APP_ID: Record<string, DesktopGameEntry> = {
  'league of legends.exe': {
    name: 'League of Legends',
    imageUrl: null,
    url: 'https://www.leagueoflegends.com/',
  },
  'valorant.exe': {
    name: 'VALORANT',
    imageUrl: null,
    url: 'https://playvalorant.com/',
  },
  'valorant-win64-shipping.exe': {
    name: 'VALORANT',
    imageUrl: null,
    url: 'https://playvalorant.com/',
  },
  'cs2.exe': steamEntry('Counter-Strike 2', 730),
  'csgo.exe': steamEntry('Counter-Strike', 730),
  'fortniteclient-win64-shipping.exe': {
    name: 'Fortnite',
    imageUrl: null,
    url: 'https://www.fortnite.com/',
  },
  'gta5.exe': steamEntry('Grand Theft Auto V', 271590),
  'gtav.exe': steamEntry('Grand Theft Auto V', 271590),
  'rdr2.exe': steamEntry('Red Dead Redemption 2', 1174180),
  'minecraft.exe': {
    name: 'Minecraft',
    imageUrl: null,
    url: 'https://www.minecraft.net/',
  },
  'javaw.exe': {
    name: 'Minecraft',
    imageUrl: null,
    url: 'https://www.minecraft.net/',
  },
  'rocketleague.exe': steamEntry('Rocket League', 252950),
  'overwatch.exe': {
    name: 'Overwatch 2',
    imageUrl: null,
    url: 'https://overwatch.blizzard.com/',
  },
  'dota2.exe': steamEntry('Dota 2', 570),
  'apex_legends.exe': steamEntry('Apex Legends', 1172470),
  'r5apex.exe': steamEntry('Apex Legends', 1172470),
  'wow.exe': {
    name: 'World of Warcraft',
    imageUrl: null,
    url: 'https://worldofwarcraft.blizzard.com/',
  },
};

/** `steam:730` veya düz exe / eski allowlist id */
function parseSteamNumericId(appId: string): string | null {
  const m = appId.match(/^steam:(\d+)$/i);
  return m ? m[1] : null;
}

export function desktopGameImageUrl(appId?: string | null): string | null {
  if (!appId) return null;
  const sid = parseSteamNumericId(appId);
  if (sid) return steamLibraryArt(Number(sid));
  return DESKTOP_GAME_BY_APP_ID[appId.toLowerCase()]?.imageUrl ?? null;
}

export function desktopGameName(appId?: string | null): string | null {
  if (!appId) return null;
  return DESKTOP_GAME_BY_APP_ID[appId.toLowerCase()]?.name ?? null;
}

export function desktopGameUrl(appId?: string | null): string | null {
  if (!appId) return null;
  const sid = parseSteamNumericId(appId);
  if (sid) return steamStoreUrl(Number(sid));
  return DESKTOP_GAME_BY_APP_ID[appId.toLowerCase()]?.url ?? null;
}
