/**
 * Steam kütüphanesinden oyun çözümleme.
 * appmanifest_*.acf + libraryfolders.vdf → installdir / appId / name
 * İnternet: Steam CDN kapak + mağaza URL (API anahtarı gerekmez).
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/** @type {{ byInstallDir: Map<string, SteamGameInfo>, byAppId: Map<string, SteamGameInfo>, loadedAt: number } | null} */
let libraryCache = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * @typedef {{ appId: string, name: string, installDir: string, imageUrl: string, url: string }} SteamGameInfo
 */

const SKIP_EXE = new Set([
  'steam.exe',
  'steamwebhelper.exe',
  'steamerrorreporter.exe',
  'gameoverlayui.exe',
  'streaming_client.exe',
  'spotify.exe',
  'electron.exe',
  'dracord.exe',
  'crashpad_handler.exe',
  'unitycrashhandler64.exe',
  'unitycrashhandler32.exe',
  'cefsharp.browsersubprocess.exe',
  'vcredist_x64.exe',
  'vcredist_x86.exe',
  'dotnet.exe',
  'msiexec.exe',
]);

/** Arka planda sürekli çalışan Steam uygulamaları — “Oynuyor” sayma */
const SKIP_STEAM_APP_IDS = new Set([
  '431960', // Wallpaper Engine
  '250820', // SteamVR
  '228980', // Steamworks Common Redistributables
  '1070560', // Steam Linux Runtime
  '1391110', // Steamworks SDK Redist
  '1493710', // Proton Experimental
  '1628350', // Steam Linux Runtime - Soldier
  '1887720', // Proton Hotfix
  '2180100', // Steam Linux Runtime - Sniper
]);

const SKIP_DIR = new Set([
  'steam',
  'steamapps',
  'common',
  'bin',
  'binaries',
  'win64',
  'win32',
  'x64',
  'x86',
  'redist',
  'directx',
  'dotnet',
  'launcher',
  'redistributables',
  'support',
  'tools',
  '_commonredist',
]);

/** Riot / Epic / Blizzard vb. — Steam dışı sabit isimler */
const NON_STEAM_ALLOWLIST = {
  'league of legends.exe': {
    name: 'League of Legends',
    url: 'https://www.leagueoflegends.com/',
  },
  'valorant.exe': { name: 'VALORANT', url: 'https://playvalorant.com/' },
  'valorant-win64-shipping.exe': {
    name: 'VALORANT',
    url: 'https://playvalorant.com/',
  },
  'fortniteclient-win64-shipping.exe': {
    name: 'Fortnite',
    url: 'https://www.fortnite.com/',
  },
  'minecraft.exe': { name: 'Minecraft', url: 'https://www.minecraft.net/' },
  'minecraft.windows.exe': {
    name: 'Minecraft',
    url: 'https://www.minecraft.net/',
  },
  'overwatch.exe': {
    name: 'Overwatch 2',
    url: 'https://overwatch.blizzard.com/',
  },
  'overwatch2.exe': {
    name: 'Overwatch 2',
    url: 'https://overwatch.blizzard.com/',
  },
  'wow.exe': {
    name: 'World of Warcraft',
    url: 'https://worldofwarcraft.blizzard.com/',
  },
  'wowclassic.exe': {
    name: 'World of Warcraft Classic',
    url: 'https://worldofwarcraft.blizzard.com/',
  },
};

function steamArt(appId) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
}

function steamStore(appId) {
  return `https://store.steampowered.com/app/${appId}`;
}

function baseName(p) {
  const norm = String(p || '').replace(/\//g, '\\');
  const i = norm.lastIndexOf('\\');
  return (i >= 0 ? norm.slice(i + 1) : norm).toLowerCase();
}

function folderFromSteamPath(exePath) {
  const norm = String(exePath || '').replace(/\//g, '\\');
  const m = norm.match(/steamapps\\common\\([^\\]+)/i);
  if (!m) return null;
  const folder = m[1].trim();
  if (!folder || SKIP_DIR.has(folder.toLowerCase())) return null;
  return folder;
}

/** Basit KeyValues (VDF/ACF) — "key"\t"value" ve iç içe bloklar */
function parseVdfObject(text) {
  const root = {};
  const stack = [root];
  let pendingKey = null;
  const re = /"((?:\\.|[^"\\])*)"|(\{)|(\})/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[2]) {
      if (pendingKey != null) {
        const obj = {};
        stack[stack.length - 1][pendingKey] = obj;
        stack.push(obj);
        pendingKey = null;
      }
      continue;
    }
    if (m[3]) {
      if (stack.length > 1) stack.pop();
      pendingKey = null;
      continue;
    }
    const token = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (pendingKey == null) {
      pendingKey = token;
    } else {
      stack[stack.length - 1][pendingKey] = token;
      pendingKey = null;
    }
  }
  return root;
}

function readTextSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

async function steamPathFromRegistry() {
  if (process.platform !== 'win32') return null;
  try {
    const { stdout } = await execFileAsync(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { windowsHide: true },
    );
    const m = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m) {
      const p = m[1].trim().replace(/\//g, '\\');
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* ignore */
  }
  try {
    const { stdout } = await execFileAsync(
      'reg',
      ['query', 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', '/v', 'InstallPath'],
      { windowsHide: true },
    );
    const m = stdout.match(/InstallPath\s+REG_SZ\s+(.+)/i);
    if (m) {
      const p = m[1].trim().replace(/\//g, '\\');
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function commonSteamPaths() {
  const out = [];
  const pf = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles;
  if (pf) out.push(path.join(pf, 'Steam'));
  if (process.env.ProgramFiles) out.push(path.join(process.env.ProgramFiles, 'Steam'));
  if (process.env.LOCALAPPDATA) {
    out.push(path.join(process.env.LOCALAPPDATA, 'Steam'));
  }
  return out.filter((p) => fs.existsSync(path.join(p, 'steam.exe')) || fs.existsSync(p));
}

async function resolveSteamRoot() {
  const fromReg = await steamPathFromRegistry();
  if (fromReg) return fromReg;
  for (const p of commonSteamPaths()) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** libraryfolders.vdf → steamapps kök dizinleri */
function collectLibrarySteamapps(steamRoot) {
  const roots = new Set();
  const defaultApps = path.join(steamRoot, 'steamapps');
  if (fs.existsSync(defaultApps)) roots.add(defaultApps);

  const vdfCandidates = [
    path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
    path.join(steamRoot, 'config', 'libraryfolders.vdf'),
  ];
  for (const vdf of vdfCandidates) {
    const text = readTextSafe(vdf);
    if (!text) continue;
    const parsed = parseVdfObject(text);
    const folders = parsed.libraryfolders || parsed.LibraryFolders || parsed;
    if (!folders || typeof folders !== 'object') continue;
    for (const [k, v] of Object.entries(folders)) {
      if (k === 'contentstatsid') continue;
      let libPath = null;
      if (typeof v === 'string') libPath = v;
      else if (v && typeof v === 'object') libPath = v.path || v.Path;
      if (!libPath) continue;
      const steamapps = path.join(libPath.replace(/\//g, '\\'), 'steamapps');
      if (fs.existsSync(steamapps)) roots.add(steamapps);
    }
  }
  return [...roots];
}

function indexManifests(steamappsDirs) {
  /** @type {Map<string, SteamGameInfo>} */
  const byInstallDir = new Map();
  /** @type {Map<string, SteamGameInfo>} */
  const byAppId = new Map();

  for (const steamapps of steamappsDirs) {
    let files = [];
    try {
      files = fs.readdirSync(steamapps);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!/^appmanifest_\d+\.acf$/i.test(f)) continue;
      const text = readTextSafe(path.join(steamapps, f));
      if (!text) continue;
      const parsed = parseVdfObject(text);
      const app = parsed.AppState || parsed.appstate || parsed;
      if (!app || typeof app !== 'object') continue;
      const appId = String(app.appid || app.AppID || '').trim();
      const name = String(app.name || app.Name || '').trim();
      const installDir = String(app.installdir || app.InstallDir || '').trim();
      if (!appId || !name) continue;
      /** @type {SteamGameInfo} */
      const info = {
        appId,
        name,
        installDir,
        imageUrl: steamArt(appId),
        url: steamStore(appId),
      };
      byAppId.set(appId, info);
      if (installDir) {
        byInstallDir.set(installDir.toLowerCase(), info);
      }
    }
  }
  return { byInstallDir, byAppId };
}

async function loadSteamLibrary(force = false) {
  if (
    !force &&
    libraryCache &&
    Date.now() - libraryCache.loadedAt < CACHE_TTL_MS
  ) {
    return libraryCache;
  }
  const root = await resolveSteamRoot();
  if (!root) {
    libraryCache = {
      byInstallDir: new Map(),
      byAppId: new Map(),
      loadedAt: Date.now(),
    };
    return libraryCache;
  }
  const steamappsDirs = collectLibrarySteamapps(root);
  const indexed = indexManifests(steamappsDirs);
  libraryCache = { ...indexed, loadedAt: Date.now() };
  return libraryCache;
}

function readSteamAppIdNearExe(exePath) {
  const dir = path.dirname(exePath);
  const candidates = [
    path.join(dir, 'steam_appid.txt'),
    path.join(dir, '..', 'steam_appid.txt'),
    path.join(dir, '..', '..', 'steam_appid.txt'),
  ];
  for (const f of candidates) {
    const t = readTextSafe(f);
    if (!t) continue;
    const id = t.trim().split(/\s+/)[0];
    if (/^\d+$/.test(id)) return id;
  }
  return null;
}

/**
 * Çalışan süreçlerden oyun listesi.
 * @returns {Promise<{ ok: boolean, games: Array<{ appId: string, name: string, details?: string|null, imageUrl?: string|null, url?: string|null }>, error?: string }>}
 */
async function detectRunningGames() {
  if (process.platform !== 'win32') {
    return { ok: true, games: [] };
  }

  const lib = await loadSteamLibrary();
  /** @type {Array<{ appId: string, name: string, details?: string|null, imageUrl?: string|null, url?: string|null }>} */
  const found = [];
  const seen = new Set();

  const push = (game) => {
    const id = String(game.appId || '').toLowerCase();
    if (!id || !game.name || seen.has(id)) return;
    if (SKIP_EXE.has(id) || SKIP_EXE.has(baseName(id))) return;
    seen.add(id);
    found.push(game);
  };

  // Steam dışı allowlist (hızlı)
  try {
    const { stdout } = await execFileAsync(
      'tasklist',
      ['/FO', 'CSV', '/NH'],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    );
    const names = new Set();
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(/^"([^"]+)"/);
      if (m) names.add(m[1].toLowerCase());
    }
    for (const [exe, meta] of Object.entries(NON_STEAM_ALLOWLIST)) {
      if (names.has(exe)) {
        push({
          appId: exe,
          name: meta.name,
          details: 'Masaüstü',
          imageUrl: null,
          url: meta.url || null,
        });
      }
    }
  } catch {
    /* ignore */
  }

  // Steam path'li süreçler
  try {
    const ps = [
      "Get-CimInstance Win32_Process |",
      " Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -match 'steamapps\\\\common') } |",
      " Select-Object -ExpandProperty ExecutablePath",
    ].join(' ');
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );

    for (const line of stdout.split(/\r?\n/)) {
      const exePath = line.trim();
      if (!exePath) continue;
      const exe = baseName(exePath);
      if (!exe || exe.endsWith('.dll') || SKIP_EXE.has(exe)) continue;

      const folder = folderFromSteamPath(exePath);
      let info = folder ? lib.byInstallDir.get(folder.toLowerCase()) : null;

      if (!info) {
        const sid = readSteamAppIdNearExe(exePath);
        if (sid) info = lib.byAppId.get(sid) || null;
        if (!info && sid) {
          info = {
            appId: sid,
            name: folder || `Steam App ${sid}`,
            installDir: folder || '',
            imageUrl: steamArt(sid),
            url: steamStore(sid),
          };
        }
      }

      if (info) {
        if (SKIP_STEAM_APP_IDS.has(String(info.appId))) continue;
        push({
          appId: `steam:${info.appId}`,
          name: info.name,
          details: 'Steam',
          imageUrl: info.imageUrl,
          url: info.url,
        });
        continue;
      }

      // Manifest yoksa klasör adını kullan (yine Steam olarak işaretle)
      if (folder) {
        push({
          appId: `steam-dir:${folder.toLowerCase()}`,
          name: folder,
          details: 'Steam',
          imageUrl: null,
          url: null,
        });
      }
    }
  } catch (e) {
    return {
      ok: found.length > 0,
      games: found,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Steam oyunlarını önceliklendir (liste başı)
  found.sort((a, b) => {
    const as = String(a.appId).startsWith('steam') ? 0 : 1;
    const bs = String(b.appId).startsWith('steam') ? 0 : 1;
    return as - bs;
  });

  return { ok: true, games: found };
}

module.exports = {
  detectRunningGames,
  loadSteamLibrary,
  steamArt,
  steamStore,
};
