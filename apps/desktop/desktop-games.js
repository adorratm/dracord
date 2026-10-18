/**
 * Masaüstü oyun algılama + kütüphane tarama + manuel kayıt.
 * Steam (appmanifest), Epic (.item), kullanıcı kayıtları (userData).
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { app } = require('electron');

const execFileAsync = promisify(execFile);

/** @typedef {{ appId: string, name: string, installDir?: string, imageUrl?: string|null, url?: string|null, exePath?: string|null, exeName?: string|null, source?: string, enabled?: boolean }} GameEntry */

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
]);

const SKIP_STEAM_APP_IDS = new Set([
  '431960',
  '250820',
  '228980',
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
  'engine',
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
  'javaw.exe': { name: 'Minecraft / Java', url: null },
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
  'cs2.exe': { name: 'Counter-Strike 2', url: null },
  'dota2.exe': { name: 'Dota 2', url: null },
  'r5apex.exe': { name: 'Apex Legends', url: null },
  'apex_legends.exe': { name: 'Apex Legends', url: null },
};

/** @type {{ byInstallDir: Map<string, any>, byAppId: Map<string, any>, loadedAt: number } | null} */
let steamCache = null;
const CACHE_TTL_MS = 5 * 60 * 1000;
let didAutoImport = false;

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
  ]) {
    try {
      const { stdout } = await execFileAsync('reg', args, { windowsHide: true });
      const m = stdout.match(/(?:SteamPath|InstallPath)\s+REG_SZ\s+(.+)/i);
      if (m) {
        const p = m[1].trim().replace(/\//g, '\\');
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
  const pf = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles;
  if (pf) out.push(path.join(pf, 'Steam'));
  if (process.env.ProgramFiles) out.push(path.join(process.env.ProgramFiles, 'Steam'));
  return out.filter((p) => fs.existsSync(p));
}

async function resolveSteamRoot() {
  return (await steamPathFromRegistry()) || commonSteamPaths()[0] || null;
}

function collectLibrarySteamapps(steamRoot) {
  const roots = new Set();
  const defaultApps = path.join(steamRoot, 'steamapps');
  if (fs.existsSync(defaultApps)) roots.add(defaultApps);
  for (const vdf of [
    path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
    path.join(steamRoot, 'config', 'libraryfolders.vdf'),
  ]) {
    const text = readTextSafe(vdf);
    if (!text) continue;
    const parsed = parseVdfObject(text);
    const folders = parsed.libraryfolders || parsed.LibraryFolders || parsed;
    if (!folders || typeof folders !== 'object') continue;
    for (const [k, v] of Object.entries(folders)) {
      if (k === 'contentstatsid') continue;
      let libPath = typeof v === 'string' ? v : v?.path || v?.Path;
      if (!libPath) continue;
      const steamapps = path.join(String(libPath).replace(/\//g, '\\'), 'steamapps');
      if (fs.existsSync(steamapps)) roots.add(steamapps);
    }
  }
  return [...roots];
}

function indexSteamManifests(steamappsDirs) {
  const byInstallDir = new Map();
  const byAppId = new Map();
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
      const installPath =
        installDir && fs.existsSync(common)
          ? path.join(common, installDir)
          : null;
      const info = {
        appId: `steam:${appId}`,
        name,
        installDir,
        installPath,
        imageUrl: steamArt(appId),
        url: steamStore(appId),
        source: 'steam',
        enabled: true,
      };
      byAppId.set(appId, info);
      if (installDir) byInstallDir.set(installDir.toLowerCase(), info);
      list.push(info);
    }
  }
  return { byInstallDir, byAppId, list };
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
      list: [],
      loadedAt: Date.now(),
    };
    return steamCache;
  }
  const indexed = indexSteamManifests(collectLibrarySteamapps(root));
  steamCache = { ...indexed, loadedAt: Date.now() };
  return steamCache;
}

/** Epic Games Launcher .item manifests */
function scanEpicGames() {
  /** @type {GameEntry[]} */
  const out = [];
  const roots = [
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'),
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'),
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
        // Launch exe: LaunchExecutable
        const launch = String(raw.LaunchExecutable || '').trim();
        const exePath = launch ? path.join(install, launch) : null;
        out.push({
          appId: id,
          name,
          installPath: install,
          exePath: exePath && fs.existsSync(exePath) ? exePath : null,
          exeName: launch ? baseName(launch) : null,
          imageUrl: null,
          url: null,
          source: 'epic',
          enabled: true,
        });
      } catch {
        /* skip bad item */
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

/** Tüm süreç ExecutablePath listesi */
async function listProcessPaths() {
  if (process.platform !== 'win32') return [];
  const parseLines = (stdout) =>
    String(stdout || '')
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^"|"$/g, ''))
      .filter((l) => l && /\.exe$/i.test(l));

  try {
    const ps =
      "Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | Select-Object -ExpandProperty ExecutablePath";
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
    );
    const paths = parseLines(stdout);
    if (paths.length) return paths;
  } catch {
    /* fallback below */
  }

  // Eski Windows / kısıtlı ortam: WMIC
  try {
    const { stdout } = await execFileAsync(
      'wmic',
      ['process', 'get', 'ExecutablePath', '/FORMAT:LIST'],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
    );
    const paths = [];
    for (const line of String(stdout).split(/\r?\n/)) {
      const m = line.match(/^ExecutablePath=(.+)$/i);
      if (m?.[1]?.trim()) paths.push(m[1].trim());
    }
    return paths.filter((p) => /\.exe$/i.test(p));
  } catch {
    return [];
  }
}

async function listRunningExeNames() {
  const names = new Set();
  try {
    const { stdout } = await execFileAsync(
      'tasklist',
      ['/FO', 'CSV', '/NH'],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
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

/**
 * Kütüphane taraması — Steam + Epic + kayıtlılar (UI listesi).
 */
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
  // Kayıtlılar üzerine yaz (enabled tercihi korunur)
  for (const g of registered) {
    byId.set(g.appId, { ...byId.get(g.appId), ...g });
  }

  const games = [...byId.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'tr'),
  );
  return { ok: true, games, steamCount: steam.list?.length ?? 0, epicCount: epic.length };
}

/**
 * Tarama sonucunu kayıtlı listeye birleştir (yeni olanlar enabled).
 */
async function importScanToRegistered() {
  const scan = await scanGameLibrary();
  const existing = loadRegistered();
  const map = new Map(existing.map((g) => [g.appId, g]));
  for (const g of scan.games) {
    if (!map.has(g.appId)) {
      map.set(g.appId, { ...g, enabled: true });
    }
  }
  const games = [...map.values()];
  saveRegistered(games);
  return { ok: true, games, added: games.length - existing.length };
}

function addManualGame(entry) {
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
  const appId = `manual:${exePath.toLowerCase()}`;
  const games = loadRegistered().filter((g) => g.appId !== appId);
  games.push({
    appId,
    name,
    exePath,
    exeName: exe,
    imageUrl: entry?.imageUrl ?? null,
    url: entry?.url ?? null,
    source: 'manual',
    enabled: true,
  });
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
 * Çalışan oyunları bul — Steam path + Epic path + kayıtlı exe + allowlist.
 */
async function detectRunningGames() {
  if (process.platform !== 'win32') {
    return { ok: true, games: [] };
  }

  // İlk çalıştırmada kütüphaneyi sessizce kaydet (manuel tarama gerekmeden)
  if (!didAutoImport && loadRegistered().length === 0) {
    didAutoImport = true;
    try {
      await importScanToRegistered();
    } catch {
      /* ignore */
    }
  }

  const steam = await loadSteamLibrary();
  const registered = loadRegistered().filter((g) => g.enabled !== false);
  const paths = await listProcessPaths();
  const runningNames = await listRunningExeNames();
  /** @type {GameEntry[]} */
  const found = [];
  const seen = new Set();

  const push = (game) => {
    const id = String(game.appId || '').toLowerCase();
    if (!id || !game.name || seen.has(id)) return;
    const exe = baseName(game.exeName || game.appId);
    if (SKIP_EXE.has(exe) || SKIP_EXE.has(id)) return;
    seen.add(id);
    found.push({
      appId: game.appId,
      name: game.name,
      details: game.details || game.source || 'Masaüstü',
      imageUrl: game.imageUrl ?? null,
      url: game.url ?? null,
    });
  };

  // 1) Allowlist (tasklist)
  for (const [exe, meta] of Object.entries(NON_STEAM_ALLOWLIST)) {
    if (runningNames.has(exe)) {
      push({
        appId: exe,
        name: meta.name,
        details: 'Masaüstü',
        url: meta.url,
        source: 'allowlist',
      });
    }
  }

  // 2) Kayıtlı oyunlar — install klasörü / exe yolu / exe adı
  for (const g of registered) {
    const exe = (g.exeName || baseName(g.exePath || '')).toLowerCase();
    if (exe && SKIP_EXE.has(exe)) continue;

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
          (exe && baseName(p) === exe),
      );

    const nameHit = !!exe && runningNames.has(exe);
    const hit =
      underInstall ||
      pathHit ||
      (nameHit && (g.source === 'manual' || !!g.exePath));

    if (!hit) continue;

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

  // 3) Steam process paths
  for (const exePath of paths) {
    const exe = baseName(exePath);
    if (!exe || exe.endsWith('.dll') || SKIP_EXE.has(exe)) continue;

    const folder = folderFromSteamPath(exePath);
    if (folder) {
      let info = steam.byInstallDir.get(folder.toLowerCase());
      if (!info) {
        const sid = readSteamAppIdNearExe(exePath);
        if (sid && !SKIP_STEAM_APP_IDS.has(sid)) {
          info = steam.byAppId.get(sid) || {
            appId: `steam:${sid}`,
            name: folder,
            imageUrl: steamArt(sid),
            url: steamStore(sid),
            source: 'steam',
          };
        }
      }
      if (info && !SKIP_STEAM_APP_IDS.has(String(info.appId).replace(/^steam:/, ''))) {
        push({
          ...info,
          appId: String(info.appId).startsWith('steam:')
            ? info.appId
            : `steam:${info.appId}`,
          details: 'Steam',
        });
        continue;
      }
      if (folder) {
        push({
          appId: `steam-dir:${folder.toLowerCase()}`,
          name: folder,
          details: 'Steam',
          source: 'steam',
        });
      }
      continue;
    }

    // Epic install path
    if (/\\epic games\\/i.test(exePath) || /\\epicgames\\/i.test(exePath)) {
      const parts = exePath.replace(/\//g, '\\').split('\\');
      const eg = parts.findIndex((p) => /^epic games$/i.test(p) || /^epicgames$/i.test(p));
      const folder = eg >= 0 ? parts[eg + 1] : null;
      if (folder && !SKIP_DIR.has(folder.toLowerCase()) && !SKIP_EXE.has(exe)) {
        push({
          appId: `epic-dir:${folder.toLowerCase()}`,
          name: folder,
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

  return { ok: true, games: found };
}

module.exports = {
  detectRunningGames,
  loadSteamLibrary,
  scanGameLibrary,
  importScanToRegistered,
  addManualGame,
  removeRegisteredGame,
  setGameEnabled,
  getRegistered,
  steamArt,
  steamStore,
};
