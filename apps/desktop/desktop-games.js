/**
 * Masaüstü oyun algılama + kütüphane tarama + manuel kayıt.
 * Steam: RunningAppID (registry) + appmanifest + çalışan exe eşlemesi.
 * Epic: .item manifests. Manuel: exe + ikon.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { app, nativeImage } = require('electron');

const execFileAsync = promisify(execFile);

/** @typedef {{ appId: string, name: string, installDir?: string|null, installPath?: string|null, imageUrl?: string|null, url?: string|null, exePath?: string|null, exeName?: string|null, exeNames?: string[], source?: string, enabled?: boolean, steamAppId?: string|null }} GameEntry */

const SKIP_EXE = new Set([
  'steam.exe',
  'steamwebhelper.exe',
  'steamerrorreporter.exe',
  'gameoverlayui.exe',
  'gameoverlayui64.exe',
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
  'explorer.exe',
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
  'conhost.exe',
  'runtimebroker.exe',
  'searchhost.exe',
  'textinputhost.exe',
  'applicationframehost.exe',
  'systemsettings.exe',
  'taskmgr.exe',
  'msedge.exe',
  'chrome.exe',
  'firefox.exe',
  'code.exe',
  'discord.exe',
  'epicgameslauncher.exe',
  'epicwebhelper.exe',
  'battle.net.exe',
  'agent.exe',
  'origin.exe',
  'eadesktop.exe',
  'galaxyclient.exe',
  'riotclientservices.exe',
  'leagueclient.exe',
  'leagueclientux.exe',
  'installerscripts.exe',
  'steamerrorreporter64.exe',
  'wallpaper_engine.exe',
  'wallpaper32.exe',
  'wallpaper64.exe',
  'wallpaperengine.exe',
]);

const SKIP_STEAM_APP_IDS = new Set([
  '431960', // Wallpaper Engine
  '250820', // SteamVR
  '228980', // Steamworks Common Redistributables
  '1070560',
  '1391110',
  '1493710',
  '1628350',
  '1887720',
  '2180100',
]);

const SKIP_DIR = new Set([
  'steam',
  'steamapps',
  'common',
  'bin',
  'redist',
  'directx',
  'dotnet',
  'launcher',
  'redistributables',
  'support',
  'tools',
  '_commonredist',
  'engine',
  '__installer',
  'crashpad',
  'wallpaper engine',
]);

/** Bilinen Steam dışı exe → isim */
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
  'gta5.exe': { name: 'Grand Theft Auto V', url: null },
  'gtav.exe': { name: 'Grand Theft Auto V', url: null },
  'rdr2.exe': { name: 'Red Dead Redemption 2', url: null },
  'rocketleague.exe': { name: 'Rocket League', url: null },
  'cs2.exe': { name: 'Counter-Strike 2', url: 'https://store.steampowered.com/app/730' },
  'dota2.exe': { name: 'Dota 2', url: 'https://store.steampowered.com/app/570' },
  'r5apex.exe': { name: 'Apex Legends', url: null },
  'apex_legends.exe': { name: 'Apex Legends', url: null },
};

/** @type {{ byInstallDir: Map<string, any>, byAppId: Map<string, any>, byExeName: Map<string, any>, list: GameEntry[], steamRoot: string|null, loadedAt: number } | null} */
let steamCache = null;
const CACHE_TTL_MS = 3 * 60 * 1000;
let didAutoImport = false;

function steamArt(appId) {
  const id = String(appId).replace(/^steam:/, '');
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
}
function steamHeader(appId) {
  const id = String(appId).replace(/^steam:/, '');
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
}
function steamStore(appId) {
  const id = String(appId).replace(/^steam:/, '');
  return `https://store.steampowered.com/app/${id}`;
}

/** @type {Map<string, string>} */
const steamNameCache = new Map();

/** Store API’den oyun adı (RunningAppID bilinmeyen oyunlar için) */
function fetchSteamAppName(appId) {
  const id = String(appId);
  if (steamNameCache.has(id)) return Promise.resolve(steamNameCache.get(id) || null);
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const req = https.get(
        `https://store.steampowered.com/api/appdetails?appids=${id}&l=turkish`,
        { timeout: 4000 },
        (res) => {
          let raw = '';
          res.on('data', (c) => {
            raw += c;
          });
          res.on('end', () => {
            try {
              const j = JSON.parse(raw);
              const name = j?.[id]?.data?.name;
              if (name) steamNameCache.set(id, name);
              resolve(name || null);
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
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
    if (pendingKey == null) pendingKey = token;
    else {
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

function registeredFile() {
  return path.join(app.getPath('userData'), 'registered-games.json');
}

function iconsDir() {
  const dir = path.join(app.getPath('userData'), 'game-icons');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** @returns {GameEntry[]} */
function loadRegistered() {
  try {
    const raw = fs.readFileSync(registeredFile(), 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.games) ? parsed.games : [];
    return list.filter((g) => g && g.appId && g.name);
  } catch {
    return [];
  }
}

/** @param {GameEntry[]} games */
function saveRegistered(games) {
  const file = registeredFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ games, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

async function steamPathFromRegistry() {
  if (process.platform !== 'win32') return null;
  for (const args of [
    ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
    ['query', 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', '/v', 'InstallPath'],
    ['query', 'HKLM\\SOFTWARE\\Valve\\Steam', '/v', 'InstallPath'],
  ]) {
    try {
      const { stdout } = await execFileAsync('reg', args, { windowsHide: true });
      const m = stdout.match(/(?:SteamPath|InstallPath)\s+REG_SZ\s+(.+)/i);
      if (m) {
        const p = path.normalize(m[1].trim().replace(/\//g, '\\'));
        if (fs.existsSync(p)) return p;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

function commonSteamPaths() {
  const out = [];
  const pf86 = process.env['ProgramFiles(x86)'];
  const pf = process.env.ProgramFiles;
  if (pf86) out.push(path.join(pf86, 'Steam'));
  if (pf) out.push(path.join(pf, 'Steam'));
  out.push('C:\\Program Files (x86)\\Steam');
  out.push('C:\\Program Files\\Steam');
  out.push('D:\\Steam');
  out.push('D:\\SteamLibrary');
  return [...new Set(out)].filter((p) => fs.existsSync(p));
}

async function resolveSteamRoot() {
  return (await steamPathFromRegistry()) || commonSteamPaths()[0] || null;
}

/**
 * Steam'in aktif oyun AppID'si (oyun açıkken REG_DWORD > 0).
 */
async function getSteamRunningAppId() {
  if (process.platform !== 'win32') return null;
  try {
    const { stdout } = await execFileAsync(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'],
      { windowsHide: true },
    );
    const hex = stdout.match(/RunningAppID\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return n > 0 ? String(n) : null;
    }
    const dec = stdout.match(/RunningAppID\s+REG_DWORD\s+(\d+)/);
    if (dec) {
      const n = parseInt(dec[1], 10);
      return n > 0 ? String(n) : null;
    }
  } catch {
    /* yok */
  }
  return null;
}

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
      if (k === 'contentstatsid' || k === 'TimeNextStatsReport') continue;
      let libPath = typeof v === 'string' ? v : v?.path || v?.Path;
      if (!libPath || typeof libPath !== 'string') continue;
      libPath = libPath.replace(/\//g, '\\').replace(/\\\\/g, '\\');
      const steamapps = path.join(libPath, 'steamapps');
      if (fs.existsSync(steamapps)) roots.add(steamapps);
      // Bazen path doğrudan steam kökü
      else if (fs.existsSync(path.join(libPath, 'steamapps', 'common'))) {
        roots.add(path.join(libPath, 'steamapps'));
      }
    }
  }
  return [...roots];
}

/** Kurulum klasöründeki aday oyun exe'leri (hızlı, sığ tarama) */
function findGameExes(installPath, max = 16) {
  /** @type {string[]} */
  const found = [];
  if (!installPath || !fs.existsSync(installPath)) return found;

  const preferDirs = new Set([
    'binaries',
    'win64',
    'win32',
    'x64',
    'x86',
    'bin',
    'game',
    'shipping',
  ]);

  const visit = (dir, depth) => {
    if (found.length >= max || depth > 3) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // Önce exe'ler
    for (const ent of entries) {
      if (found.length >= max) break;
      if (!ent.isFile() || !/\.exe$/i.test(ent.name)) continue;
      const n = ent.name.toLowerCase();
      if (SKIP_EXE.has(n)) continue;
      if (!found.includes(n)) found.push(n);
    }
    if (depth >= 3) return;
    // Öncelikli alt klasörler
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => {
        const dn = name.toLowerCase();
        if (dn.startsWith('.') || SKIP_DIR.has(dn)) return false;
        if (/redistributable|directx|dotnet|vcredist|__installer/i.test(dn))
          return false;
        return true;
      })
      .sort((a, b) => {
        const pa = preferDirs.has(a.toLowerCase()) ? 0 : 1;
        const pb = preferDirs.has(b.toLowerCase()) ? 0 : 1;
        return pa - pb;
      });
    for (const name of dirs) {
      if (found.length >= max) break;
      visit(path.join(dir, name), depth + 1);
    }
  };

  visit(installPath, 0);
  return found;
}

function indexSteamManifests(steamappsDirs) {
  const byInstallDir = new Map();
  const byAppId = new Map();
  const byExeName = new Map();
  /** @type {GameEntry[]} */
  const list = [];

  for (const steamapps of steamappsDirs) {
    let files = [];
    try {
      files = fs.readdirSync(steamapps);
    } catch {
      continue;
    }
    const common = path.join(steamapps, 'common');
    for (const f of files) {
      if (!/^appmanifest_\d+\.acf$/i.test(f)) continue;
      const text = readTextSafe(path.join(steamapps, f));
      if (!text) continue;
      const parsed = parseVdfObject(text);
      const appState = parsed.AppState || parsed.appstate || parsed;
      if (!appState || typeof appState !== 'object') continue;
      const appId = String(appState.appid || '').trim();
      const name = String(appState.name || '').trim();
      const installDir = String(appState.installdir || '').trim();
      if (!appId || !name || SKIP_STEAM_APP_IDS.has(appId)) continue;

      let installPath = null;
      if (installDir && fs.existsSync(common)) {
        const candidate = path.join(common, installDir);
        if (fs.existsSync(candidate)) installPath = candidate;
        else {
          // Büyük/küçük harf farkı
          try {
            const dirs = fs.readdirSync(common);
            const hit = dirs.find(
              (d) => d.toLowerCase() === installDir.toLowerCase(),
            );
            if (hit) installPath = path.join(common, hit);
          } catch {
            /* ignore */
          }
        }
      }

      const exeNames = installPath ? findGameExes(installPath) : [];
      const info = {
        appId: `steam:${appId}`,
        steamAppId: appId,
        name,
        installDir,
        installPath,
        exeNames,
        exeName: exeNames[0] || null,
        imageUrl: steamArt(appId),
        url: steamStore(appId),
        source: 'steam',
        enabled: true,
      };
      byAppId.set(appId, info);
      if (installDir) byInstallDir.set(installDir.toLowerCase(), info);
      for (const exe of exeNames) {
        if (!byExeName.has(exe)) byExeName.set(exe, info);
      }
      list.push(info);
    }
  }
  return { byInstallDir, byAppId, byExeName, list };
}

async function loadSteamLibrary(force = false) {
  if (!force && steamCache && Date.now() - steamCache.loadedAt < CACHE_TTL_MS) {
    return steamCache;
  }
  const root = await resolveSteamRoot();
  if (!root) {
    steamCache = {
      byInstallDir: new Map(),
      byAppId: new Map(),
      byExeName: new Map(),
      list: [],
      steamRoot: null,
      loadedAt: Date.now(),
    };
    return steamCache;
  }
  const indexed = indexSteamManifests(collectLibrarySteamapps(root));
  steamCache = { ...indexed, steamRoot: root, loadedAt: Date.now() };
  return steamCache;
}

function scanEpicGames() {
  /** @type {GameEntry[]} */
  const out = [];
  const roots = [
    path.join(
      process.env.ProgramData || 'C:\\ProgramData',
      'Epic',
      'EpicGamesLauncher',
      'Data',
      'Manifests',
    ),
  ];
  const seen = new Set();
  for (const dir of roots) {
    if (!fs.existsSync(dir)) continue;
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.item'));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const name = String(raw.DisplayName || raw.AppName || '').trim();
        const install = String(raw.InstallLocation || '').trim();
        const cat = String(raw.CatalogNamespace || raw.AppName || f).trim();
        if (!name || !install) continue;
        const id = `epic:${cat.toLowerCase()}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const launch = String(raw.LaunchExecutable || '').trim();
        const exePath = launch ? path.join(install, launch) : null;
        const exeNames = findGameExes(install, 8);
        if (launch) {
          const ln = baseName(launch);
          if (ln && !exeNames.includes(ln)) exeNames.unshift(ln);
        }
        out.push({
          appId: id,
          name,
          installPath: install,
          exePath: exePath && fs.existsSync(exePath) ? exePath : null,
          exeName: launch ? baseName(launch) : exeNames[0] || null,
          exeNames,
          imageUrl: null,
          url: null,
          source: 'epic',
          enabled: true,
        });
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

function readSteamAppIdNearExe(exePath) {
  const dir = path.dirname(exePath);
  for (const f of [
    path.join(dir, 'steam_appid.txt'),
    path.join(dir, '..', 'steam_appid.txt'),
    path.join(dir, '..', '..', 'steam_appid.txt'),
  ]) {
    const t = readTextSafe(f);
    if (!t) continue;
    const id = t.trim().split(/\s+/)[0];
    if (/^\d+$/.test(id)) return id;
  }
  return null;
}

/** ExecutablePath + CommandLine'dan exe yolları */
async function listProcessPaths() {
  if (process.platform !== 'win32') return [];
  const paths = new Set();

  const addPath = (p) => {
    if (!p || typeof p !== 'string') return;
    let s = p.trim().replace(/^"|"$/g, '');
    // CommandLine: "C:\...\game.exe" -args
    const m = s.match(/^"([^"]+\.exe)"/i) || s.match(/^(\S+\.exe)/i);
    if (m) s = m[1];
    if (/\.exe$/i.test(s)) paths.add(s);
  };

  try {
    const ps = [
      '$ErrorActionPreference="SilentlyContinue";',
      'Get-CimInstance Win32_Process | ForEach-Object {',
      '  if ($_.ExecutablePath) { $_.ExecutablePath }',
      '  elseif ($_.CommandLine) { $_.CommandLine }',
      '}',
    ].join(' ');
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
    );
    for (const line of String(stdout).split(/\r?\n/)) addPath(line);
  } catch {
    /* fallback */
  }

  if (paths.size === 0) {
    try {
      const { stdout } = await execFileAsync(
        'wmic',
        ['process', 'get', 'ExecutablePath,CommandLine', '/FORMAT:LIST'],
        { windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
      );
      for (const line of String(stdout).split(/\r?\n/)) {
        const m = line.match(/^(?:ExecutablePath|CommandLine)=(.*)$/i);
        if (m?.[1]?.trim()) addPath(m[1]);
      }
    } catch {
      /* ignore */
    }
  }

  return [...paths];
}

async function listRunningExeNames() {
  const names = new Set();
  try {
    const { stdout } = await execFileAsync(
      'tasklist',
      ['/FO', 'CSV', '/NH'],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(/^"([^"]+)"/);
      if (m) names.add(m[1].toLowerCase());
    }
  } catch {
    /* ignore */
  }
  return names;
}

async function extractExeIconDataUrl(exePath) {
  try {
    const img = await app.getFileIcon(exePath, { size: 'large' });
    if (!img || img.isEmpty()) return null;
    const png = img.toPNG();
    const hash = crypto
      .createHash('sha1')
      .update(exePath.toLowerCase())
      .digest('hex')
      .slice(0, 16);
    const file = path.join(iconsDir(), `${hash}.png`);
    fs.writeFileSync(file, png);
    // Yerel gösterim + presence için data URL (küçük ikon)
    const small = nativeImage.createFromBuffer(png);
    const resized = small.resize({ width: 64, height: 64, quality: 'best' });
    return resized.toDataURL();
  } catch {
    return null;
  }
}

async function scanGameLibrary() {
  const steam = await loadSteamLibrary(true);
  const epic = scanEpicGames();
  const registered = loadRegistered();
  const byId = new Map();

  for (const g of steam.list || []) {
    byId.set(g.appId, { ...g, enabled: g.enabled !== false });
  }
  for (const g of epic) {
    if (!byId.has(g.appId)) byId.set(g.appId, g);
  }
  for (const g of registered) {
    byId.set(g.appId, { ...byId.get(g.appId), ...g });
  }

  const games = [...byId.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'tr'),
  );
  return {
    ok: true,
    games,
    steamCount: steam.list?.length ?? 0,
    epicCount: epic.length,
    steamRoot: steam.steamRoot || null,
  };
}

async function importScanToRegistered() {
  const scan = await scanGameLibrary();
  if (!scan.ok) return scan;
  const existing = loadRegistered();
  const map = new Map(existing.map((g) => [g.appId, g]));
  let added = 0;
  for (const g of scan.games) {
    if (!map.has(g.appId)) {
      map.set(g.appId, { ...g, enabled: true });
      added += 1;
    } else {
      // Exe listesini / kapak URL'ini güncelle, kullanıcı adını koru
      const prev = map.get(g.appId);
      map.set(g.appId, {
        ...g,
        ...prev,
        exeNames: g.exeNames || prev.exeNames,
        exeName: g.exeName || prev.exeName,
        installPath: g.installPath || prev.installPath,
        imageUrl: prev.imageUrl || g.imageUrl,
        url: prev.url || g.url,
        steamAppId: g.steamAppId || prev.steamAppId,
        enabled: prev.enabled !== false,
      });
    }
  }
  const games = [...map.values()];
  saveRegistered(games);
  return {
    ok: true,
    games,
    added,
    steamCount: scan.steamCount,
    epicCount: scan.epicCount,
    steamRoot: scan.steamRoot,
  };
}

async function addManualGame(entry) {
  const exePath = String(entry?.exePath || '').trim();
  if (!exePath || !fs.existsSync(exePath)) {
    return { ok: false, error: 'exe_not_found' };
  }
  const exe = baseName(exePath);
  if (!exe.endsWith('.exe') || SKIP_EXE.has(exe)) {
    return { ok: false, error: 'invalid_exe' };
  }
  const name =
    String(entry?.name || '').trim() ||
    path.basename(exePath, path.extname(exePath));

  // Steam klasöründeyse steam kaydı olarak bağla
  const folder = folderFromSteamPath(exePath);
  let steamMeta = null;
  if (folder) {
    const steam = await loadSteamLibrary();
    steamMeta = steam.byInstallDir.get(folder.toLowerCase()) || null;
    if (!steamMeta) {
      const sid = readSteamAppIdNearExe(exePath);
      if (sid && steam.byAppId.get(sid)) steamMeta = steam.byAppId.get(sid);
    }
  }

  const appId = steamMeta?.appId || `manual:${exePath.toLowerCase()}`;
  let imageUrl = entry?.imageUrl ?? null;
  if (!imageUrl && steamMeta?.imageUrl) imageUrl = steamMeta.imageUrl;
  if (!imageUrl) imageUrl = await extractExeIconDataUrl(exePath);

  const games = loadRegistered().filter((g) => g.appId !== appId);
  games.push({
    appId,
    name: steamMeta && !entry?.name ? steamMeta.name : name,
    exePath,
    exeName: exe,
    exeNames: [exe],
    imageUrl,
    url: steamMeta?.url || entry?.url || null,
    source: steamMeta ? 'steam' : 'manual',
    steamAppId: steamMeta?.steamAppId || null,
    installPath: steamMeta?.installPath || path.dirname(exePath),
    enabled: true,
  });
  saveRegistered(games);
  return { ok: true, games };
}

function renameRegisteredGame(appId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, error: 'empty_name', games: loadRegistered() };
  const games = loadRegistered();
  let found = false;
  for (const g of games) {
    if (g.appId === appId) {
      g.name = trimmed;
      found = true;
    }
  }
  if (!found) return { ok: false, error: 'not_found', games };
  saveRegistered(games);
  return { ok: true, games };
}

function removeRegisteredGame(appId) {
  const games = loadRegistered().filter((g) => g.appId !== appId);
  saveRegistered(games);
  return { ok: true, games };
}

function setGameEnabled(appId, enabled) {
  const games = loadRegistered();
  let found = false;
  for (const g of games) {
    if (g.appId === appId) {
      g.enabled = Boolean(enabled);
      found = true;
    }
  }
  if (!found) return { ok: false, error: 'not_found', games };
  saveRegistered(games);
  return { ok: true, games };
}

function getRegistered() {
  return { ok: true, games: loadRegistered() };
}

/**
 * Çalışan oyunları bul.
 * Öncelik: Steam RunningAppID → exe adı eşlemesi → path → allowlist.
 */
async function detectRunningGames() {
  if (process.platform !== 'win32') {
    return { ok: true, games: [] };
  }

  if (!didAutoImport) {
    didAutoImport = true;
    try {
      if (loadRegistered().length === 0) await importScanToRegistered();
      else await loadSteamLibrary(true);
    } catch {
      /* ignore */
    }
  }

  const steam = await loadSteamLibrary();
  const registered = loadRegistered().filter((g) => g.enabled !== false);
  const [paths, runningNames, runningSteamId] = await Promise.all([
    listProcessPaths(),
    listRunningExeNames(),
    getSteamRunningAppId(),
  ]);

  /** @type {GameEntry[]} */
  const found = [];
  const seen = new Set();

  const push = (game) => {
    const id = String(game.appId || '').toLowerCase();
    if (!id || !game.name || seen.has(id)) return;
    const exe = baseName(game.exeName || '');
    if (exe && SKIP_EXE.has(exe)) return;
    seen.add(id);
    const steamId = String(game.steamAppId || id.replace(/^steam:/, ''));
    found.push({
      appId: game.appId,
      name: game.name,
      details: game.details || game.source || 'Masaüstü',
      imageUrl: game.imageUrl || ( /^\d+$/.test(steamId) ? steamArt(steamId) : null),
      url: game.url || ( /^\d+$/.test(steamId) ? steamStore(steamId) : null),
    });
  };

  // 0) Steam RunningAppID — en güvenilir sinyal
  if (runningSteamId && !SKIP_STEAM_APP_IDS.has(runningSteamId)) {
    let info = steam.byAppId.get(runningSteamId);
    if (!info) {
      const reg = registered.find(
        (g) =>
          g.steamAppId === runningSteamId ||
          g.appId === `steam:${runningSteamId}`,
      );
      if (reg) info = reg;
    }
    if (!info) {
      const storeName = await fetchSteamAppName(runningSteamId);
      info = {
        appId: `steam:${runningSteamId}`,
        steamAppId: runningSteamId,
        name: storeName || `Steam App ${runningSteamId}`,
        imageUrl: steamArt(runningSteamId),
        url: steamStore(runningSteamId),
        source: 'steam',
      };
    }
    push({
      ...info,
      appId: `steam:${runningSteamId}`,
      steamAppId: runningSteamId,
      imageUrl: info.imageUrl || steamArt(runningSteamId),
      url: info.url || steamStore(runningSteamId),
      details: 'Steam',
    });
  }

  // 1) Allowlist
  for (const [exe, meta] of Object.entries(NON_STEAM_ALLOWLIST)) {
    if (runningNames.has(exe)) {
      // Steam'de varsa steam kaydını tercih et
      const steamHit = steam.byExeName.get(exe);
      if (steamHit) {
        push({ ...steamHit, details: 'Steam' });
      } else {
        push({
          appId: exe,
          name: meta.name,
          details: 'Masaüstü',
          url: meta.url,
          source: 'allowlist',
        });
      }
    }
  }

  // 2) Steam / kayıtlı — çalışan exe adı ↔ oyun exe listesi
  const matchByExeNames = (g) => {
    const names = [
      ...(Array.isArray(g.exeNames) ? g.exeNames : []),
      g.exeName,
      g.exePath ? baseName(g.exePath) : null,
    ]
      .filter(Boolean)
      .map((n) => String(n).toLowerCase());
    return names.some((n) => runningNames.has(n));
  };

  for (const g of steam.list || []) {
    if (matchByExeNames(g)) {
      push({ ...g, details: 'Steam' });
    }
  }

  for (const g of registered) {
    const install = g.installPath
      ? String(g.installPath).replace(/\//g, '\\').toLowerCase()
      : '';
    const underInstall =
      !!install &&
      paths.some((p) => {
        const pl = p.toLowerCase();
        return pl === install || pl.startsWith(install + '\\');
      });
    const pathHit =
      !!g.exePath &&
      paths.some(
        (p) =>
          p.toLowerCase() === String(g.exePath).toLowerCase() ||
          baseName(p) === baseName(g.exePath),
      );
    if (underInstall || pathHit || matchByExeNames(g)) {
      push({
        ...g,
        details:
          g.source === 'steam'
            ? 'Steam'
            : g.source === 'epic'
              ? 'Epic'
              : g.source === 'manual'
                ? 'Manuel'
                : 'Masaüstü',
      });
    }
  }

  // 3) Process path → steamapps\common
  for (const exePath of paths) {
    const exe = baseName(exePath);
    if (!exe || SKIP_EXE.has(exe)) continue;

    const folder = folderFromSteamPath(exePath);
    if (folder) {
      let info = steam.byInstallDir.get(folder.toLowerCase());
      if (!info) info = steam.byExeName.get(exe);
      if (!info) {
        const sid = readSteamAppIdNearExe(exePath);
        if (sid && !SKIP_STEAM_APP_IDS.has(sid)) {
          info = steam.byAppId.get(sid) || {
            appId: `steam:${sid}`,
            steamAppId: sid,
            name: folder,
            imageUrl: steamArt(sid),
            url: steamStore(sid),
            source: 'steam',
          };
        }
      }
      if (info) {
        push({ ...info, details: 'Steam' });
      } else {
        push({
          appId: `steam-dir:${folder.toLowerCase()}`,
          name: folder,
          details: 'Steam',
          source: 'steam',
        });
      }
      continue;
    }

    if (/\\epic games\\/i.test(exePath) || /\\epicgames\\/i.test(exePath)) {
      const parts = exePath.replace(/\//g, '\\').split('\\');
      const eg = parts.findIndex(
        (p) => /^epic games$/i.test(p) || /^epicgames$/i.test(p),
      );
      const folderName = eg >= 0 ? parts[eg + 1] : null;
      if (
        folderName &&
        !SKIP_DIR.has(folderName.toLowerCase()) &&
        !SKIP_EXE.has(exe)
      ) {
        push({
          appId: `epic-dir:${folderName.toLowerCase()}`,
          name: folderName,
          details: 'Epic',
          source: 'epic',
          exeName: exe,
        });
      }
    }
  }

  found.sort((a, b) => {
    const score = (g) =>
      String(g.appId).startsWith('steam:')
        ? 0
        : String(g.appId).startsWith('epic')
          ? 1
          : String(g.appId).startsWith('manual:')
            ? 2
            : 3;
    return score(a) - score(b);
  });

  return {
    ok: true,
    games: found,
    debug: {
      steamRoot: steam.steamRoot,
      steamGames: steam.list?.length ?? 0,
      runningSteamId,
      processPathCount: paths.length,
      runningExeCount: runningNames.size,
    },
  };
}

module.exports = {
  detectRunningGames,
  loadSteamLibrary,
  scanGameLibrary,
  importScanToRegistered,
  addManualGame,
  renameRegisteredGame,
  removeRegisteredGame,
  setGameEnabled,
  getRegistered,
  extractExeIconDataUrl,
  getSteamRunningAppId,
  steamArt,
  steamHeader,
  steamStore,
};
