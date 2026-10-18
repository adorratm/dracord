const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeImage,
  screen,
  session,
  desktopCapturer,
  systemPreferences,
  dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');

// Electron varsayılan cache klasörü Windows'ta kilitlenebiliyor (Access denied).
// ready olmadan önce ayrı userData + GPU disk cache kapat.
app.setName('Dracord');
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'Dracord'));
} catch {
  // ignore
}
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');
app.commandLine.appendSwitch('disk-cache-size', '1');
// WebRTC STUN DNS (-105): Chromium AsyncDns Windows'ta sık bozuluyor
app.commandLine.appendSwitch('disable-features', 'AsyncDns');
// IPv6 AAAA hatalarını azalt (STUN lookup)
app.commandLine.appendSwitch('disable-ipv6');
// Peer join/leave UI tonları jest olmadan da çalsın
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/** Web istemcisi origin’i — API CORS + YouTube embed Referer için */
const DESKTOP_WEB_ORIGIN = 'https://dracord.com.tr';

/**
 * Renderer origin (localhost:5173 / file://) prod CORS allowlist'te değil → Failed to fetch.
 * API isteklerinde Origin'i web istemcisi gibi gönder.
 *
 * Paketli app file:// yükler; YouTube embed Referer olmadan Error 153 verir.
 * YouTube/Vimeo isteklerine geçerli https Referer enjekte et.
 */
function registerApiOriginBridge() {
  const ses = session.defaultSession;

  ses.webRequest.onBeforeSendHeaders(
    {
      urls: [
        'https://api.dracord.com.tr/*',
        'http://localhost:4000/*',
        'http://127.0.0.1:4000/*',
      ],
    },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          Origin: DESKTOP_WEB_ORIGIN,
        },
      });
    },
  );

  ses.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.youtube.com/*',
        '*://*.youtube-nocookie.com/*',
        '*://*.googlevideo.com/*',
        '*://*.ytimg.com/*',
        '*://*.vimeo.com/*',
        '*://*.vimeocdn.com/*',
      ],
    },
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'referer') delete headers[name];
      }
      // file:// / null origin’den gelen isteklerde Referer düşer → Error 153
      headers.Referer = `${DESKTOP_WEB_ORIGIN}/`;
      callback({ requestHeaders: headers });
    },
  );
}

/** Renderer'dan gelen ekran/pencere seçimi (getDisplayMedia öncesi) */
/** @type {{ sourceId: string, systemAudio: boolean } | null} */
let pendingDisplayMediaSelection = null;

async function listDesktopCaptureSources() {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    if (status !== 'granted') {
      console.warn('[desktop] screen capture permission:', status);
    }
  }
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    displayId: s.display_id || '',
    thumbnail: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : '',
    appIcon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
    kind: s.id.startsWith('screen:') ? 'screen' : 'window',
  }));
}

/** getDisplayMedia / ekran paylaşımı — seçici + sistem sesi (loopback) */
function registerMediaCaptureHandlers() {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    const allow = [
      'media',
      'display-capture',
      'mediaKeySystem',
      'fullscreen',
      'notifications',
      'clipboard-sanitized-write',
    ].includes(permission);
    callback(allow);
  });

  ses.setPermissionCheckHandler((_wc, permission) => {
    return [
      'media',
      'display-capture',
      'mediaKeySystem',
      'fullscreen',
      'notifications',
      'clipboard-sanitized-write',
    ].includes(permission);
  });

  ipcMain.handle('desktop-capturer:get-sources', async () => listDesktopCaptureSources());

  ipcMain.handle('desktop-capturer:set-selection', (_event, selection) => {
    if (
      !selection ||
      typeof selection.sourceId !== 'string' ||
      !selection.sourceId
    ) {
      pendingDisplayMediaSelection = null;
      return { ok: false };
    }
    pendingDisplayMediaSelection = {
      sourceId: selection.sourceId,
      systemAudio: Boolean(selection.systemAudio),
    };
    return { ok: true };
  });

  ipcMain.handle('desktop-capturer:clear-selection', () => {
    pendingDisplayMediaSelection = null;
    return { ok: true };
  });

  if (typeof ses.setDisplayMediaRequestHandler === 'function') {
    ses.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        try {
          const selection = pendingDisplayMediaSelection;
          pendingDisplayMediaSelection = null;
          const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: false,
          });
          if (!sources.length) {
            callback({});
            return;
          }
          const picked = selection
            ? sources.find((s) => s.id === selection.sourceId)
            : null;
          const video = picked || sources.find((s) => s.id.startsWith('screen:')) || sources[0];
          const wantAudio = selection ? selection.systemAudio : true;
          // Windows: loopback = masaüstü/uygulama sesleri (Chrome "sistem sesini paylaş")
          callback({
            video,
            audio: wantAudio && process.platform === 'win32' ? 'loopback' : undefined,
          });
        } catch (err) {
          console.error('[desktop] displayMedia handler', err);
          pendingDisplayMediaSelection = null;
          callback({});
        }
      },
      // Kendi seçicimizi kullanıyoruz (Windows'ta sistem picker yok)
      { useSystemPicker: false },
    );
  }
}

/** Sadece açıkça istenirse Vite; aksi halde paketli ui/ (ERR_CONNECTION_REFUSED önlenir) */
const preferVite = process.env.DRACORD_ELECTRON_DEV === '1';

const frameless = process.env.DRACORD_FRAMELESS === 'true';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
/** @type {boolean} */
let trayEnabled = true;

function systemPrefsFile() {
  return path.join(app.getPath('userData'), 'system-prefs.json');
}

function readStoredSystemPrefs() {
  try {
    const raw = fs.readFileSync(systemPrefsFile(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      openOnStartup: Boolean(parsed.openOnStartup),
      minimizeToTray:
        parsed.minimizeToTray === undefined ? true : Boolean(parsed.minimizeToTray),
      autoUpdate: parsed.autoUpdate === undefined ? true : Boolean(parsed.autoUpdate),
    };
  } catch {
    return { openOnStartup: false, minimizeToTray: true, autoUpdate: true };
  }
}

function writeStoredSystemPrefs(prefs) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(systemPrefsFile(), JSON.stringify(prefs, null, 2), 'utf8');
  } catch (err) {
    console.warn('[system-prefs] write', err);
  }
}

function quoteDesktopExecArg(p) {
  if (!/[\s"]/.test(p)) return p;
  return `"${String(p).replace(/"/g, '\\"')}"`;
}

/** Windows: paket yolu; Linux: ~/.config/autostart; macOS: login items */
function loginItemLaunchOptions() {
  if (process.platform !== 'win32') return {};
  if (app.isPackaged) {
    return { path: process.execPath, args: [] };
  }
  // Dev: electron.exe + apps/desktop dizini
  return { path: process.execPath, args: [path.resolve(__dirname)] };
}

function linuxAutostartPath() {
  const home = app.getPath('home');
  return path.join(home, '.config', 'autostart', 'dracord.desktop');
}

function applyLinuxAutostart(enabled) {
  const desktopPath = linuxAutostartPath();
  if (!enabled) {
    try {
      fs.unlinkSync(desktopPath);
    } catch {
      /* yoksa sorun değil */
    }
    return;
  }
  fs.mkdirSync(path.dirname(desktopPath), { recursive: true });
  const exec = app.isPackaged
    ? quoteDesktopExecArg(process.execPath)
    : `${quoteDesktopExecArg(process.execPath)} ${quoteDesktopExecArg(path.resolve(__dirname))}`;
  const iconCandidate = path.join(__dirname, 'build', 'icon.png');
  const iconLine = fs.existsSync(iconCandidate) ? `Icon=${iconCandidate}\n` : '';
  fs.writeFileSync(
    desktopPath,
    `[Desktop Entry]
Type=Application
Version=1.0
Name=Dracord
Comment=Dracord
Exec=${exec}
${iconLine}Terminal=false
Categories=Network;InstantMessaging;
X-GNOME-Autostart-enabled=true
StartupNotify=false
`,
    'utf8',
  );
}

function applyOpenAtLogin(enabled) {
  const on = Boolean(enabled);
  if (process.platform === 'linux') {
    applyLinuxAutostart(on);
    return;
  }
  // macOS + Windows
  const launch = loginItemLaunchOptions();
  app.setLoginItemSettings({
    openAtLogin: on,
    openAsHidden: false,
    enabled: true,
    name: 'Dracord',
    ...launch,
  });
}

function isOpenAtLoginEnabled() {
  if (process.platform === 'linux') {
    return fs.existsSync(linuxAutostartPath());
  }
  try {
    const launch = loginItemLaunchOptions();
    const s = app.getLoginItemSettings(launch);
    return Boolean(s.openAtLogin || s.executableWillLaunchAtLogin);
  } catch {
    return readStoredSystemPrefs().openOnStartup;
  }
}

function applySystemPrefs(partial = {}) {
  const current = readStoredSystemPrefs();
  const next = {
    openOnStartup:
      partial.openOnStartup !== undefined
        ? Boolean(partial.openOnStartup)
        : current.openOnStartup,
    minimizeToTray:
      partial.minimizeToTray !== undefined
        ? Boolean(partial.minimizeToTray)
        : current.minimizeToTray,
    autoUpdate:
      partial.autoUpdate !== undefined
        ? Boolean(partial.autoUpdate)
        : current.autoUpdate,
  };
  writeStoredSystemPrefs(next);
  trayEnabled = next.minimizeToTray;
  try {
    applyOpenAtLogin(next.openOnStartup);
  } catch (err) {
    console.warn('[system-prefs] openAtLogin', err);
  }
  return {
    ...next,
    openAtLoginApplied: isOpenAtLoginEnabled(),
  };
}

/** @type {ReturnType<typeof setInterval> | null} */
let updateCheckTimer = null;
/** Son manuel kontrol mü — UI “checking” notunu buna bağlar */
let lastUpdateCheckManual = false;

function getAppVersionString() {
  try {
    const v = app.getVersion();
    if (v && String(v).trim()) return String(v).trim();
  } catch {
    /* fallback */
  }
  try {
    return String(require('./package.json').version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

function sendUpdateEvent(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, {
    ...payload,
    currentVersion: payload.currentVersion || getAppVersionString(),
    manual: Boolean(payload.manual ?? lastUpdateCheckManual),
  });
}

function setupAutoUpdater() {
  // Sürüm her zaman yanıt versin (updater yüklenmese bile)
  try {
    ipcMain.removeHandler('updater:get-version');
  } catch {
    /* ignore */
  }
  ipcMain.handle('updater:get-version', () => getAppVersionString());

  if (!app.isPackaged) {
    console.log('[updater] skipped (dev / unpackaged)');
    ipcMain.handle('updater:check', () => {
      const ver = getAppVersionString();
      sendUpdateEvent('updater:status', {
        status: 'not-available',
        currentVersion: ver,
        version: ver,
        manual: true,
        dev: true,
      });
      return { ok: true, dev: true, currentVersion: ver };
    });
    ipcMain.handle('updater:download', () => ({ ok: false, error: 'dev' }));
    ipcMain.handle('updater:install', () => ({ ok: false, error: 'dev' }));
    return;
  }

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.warn('[updater] electron-updater load failed', err);
    ipcMain.handle('updater:check', () => {
      const ver = getAppVersionString();
      sendUpdateEvent('updater:status', {
        status: 'error',
        message: 'Güncelleyici yüklenemedi',
        currentVersion: ver,
        manual: true,
      });
      return { ok: false, error: 'updater_missing', currentVersion: ver };
    });
    ipcMain.handle('updater:download', () => ({ ok: false, error: 'updater_missing' }));
    ipcMain.handle('updater:install', () => ({ ok: false, error: 'updater_missing' }));
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // CSC_LINK yokken Windows installer imzasız kalır. publisherName doğrulaması
  // "not signed by the application owner" ile güncellemeyi düşürür.
  // Dosya bütünlüğü latest.yml içindeki sha512 ile kontrol edilir.
  if (process.platform === 'win32') {
    autoUpdater.verifyUpdateCodeSignature = async () => null;
  }

  autoUpdater.on('checking-for-update', () => {
    sendUpdateEvent('updater:status', {
      status: 'checking',
      currentVersion: getAppVersionString(),
      manual: lastUpdateCheckManual,
    });
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdateEvent('updater:status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes ?? null,
      currentVersion: getAppVersionString(),
      manual: lastUpdateCheckManual,
    });
    const prefs = readStoredSystemPrefs();
    if (prefs.autoUpdate) {
      void autoUpdater.downloadUpdate().catch((err) => {
        sendUpdateEvent('updater:status', {
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          currentVersion: getAppVersionString(),
          manual: lastUpdateCheckManual,
        });
      });
    }
  });
  autoUpdater.on('update-not-available', (info) => {
    sendUpdateEvent('updater:status', {
      status: 'not-available',
      version: info?.version || getAppVersionString(),
      currentVersion: getAppVersionString(),
      manual: lastUpdateCheckManual,
    });
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateEvent('updater:status', {
      status: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      currentVersion: getAppVersionString(),
      manual: lastUpdateCheckManual,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateEvent('updater:status', {
      status: 'downloaded',
      version: info.version,
      currentVersion: getAppVersionString(),
      manual: lastUpdateCheckManual,
    });
  });
  autoUpdater.on('error', (err) => {
    sendUpdateEvent('updater:status', {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
      currentVersion: getAppVersionString(),
      manual: lastUpdateCheckManual,
    });
  });

  const CHECK_TIMEOUT_MS = 25_000;

  const check = async (manual = false) => {
    lastUpdateCheckManual = Boolean(manual);
    const ver = getAppVersionString();
    try {
      const result = await Promise.race([
        autoUpdater.checkForUpdates(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Güncelleme kontrolü zaman aşımı')),
            CHECK_TIMEOUT_MS,
          ),
        ),
      ]);
      return { ok: true, currentVersion: ver, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (manual) {
        sendUpdateEvent('updater:status', {
          status: 'error',
          message,
          currentVersion: ver,
          manual: true,
        });
      }
      return { ok: false, error: message, currentVersion: ver };
    } finally {
      if (!manual) lastUpdateCheckManual = false;
    }
  };

  ipcMain.handle('updater:check', async () => {
    const r = await check(true);
    return {
      ok: r.ok !== false,
      currentVersion: r.currentVersion || getAppVersionString(),
      error: r.error,
    };
  });
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
  ipcMain.handle('updater:install', () => {
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { ok: true };
  });

  // İlk kontrol (pencere hazır olduktan biraz sonra)
  setTimeout(() => {
    void check(false);
  }, 8_000);
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = setInterval(() => {
    void check(false);
  }, 4 * 60 * 60 * 1000);
}

function resolveAppIconPath() {
  const candidates = [
    path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function loadAppIcon() {
  const iconPath = resolveAppIconPath();
  if (!iconPath) return undefined;
  const img = nativeImage.createFromPath(iconPath);
  return img.isEmpty() ? undefined : img;
}

function resolveLocalUiFile() {
  const candidates = [
    path.join(__dirname, 'ui', 'index.html'),
    path.join(__dirname, '..', 'desktop-ui', 'dist', 'index.html'),
    path.join(process.resourcesPath || __dirname, 'ui', 'index.html'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function probeUrl(url, timeoutMs = 600) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? require('https') : require('http');
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function resolveUiEntry() {
  if (process.env.DRACORD_APP_URL) {
    return { type: 'url', value: process.env.DRACORD_APP_URL };
  }
  if (preferVite) {
    const vite = 'http://127.0.0.1:5173';
    if (await probeUrl(vite)) return { type: 'url', value: vite };
    const file = resolveLocalUiFile();
    if (file) {
      console.warn('Vite 5173 kapalı — paketli ui/ yükleniyor');
      return { type: 'file', value: file };
    }
    return { type: 'url', value: vite };
  }
  const file = resolveLocalUiFile();
  if (file) return { type: 'file', value: file };
  const vite = 'http://127.0.0.1:5173';
  if (await probeUrl(vite)) return { type: 'url', value: vite };
  return { type: 'file', value: path.join(__dirname, 'ui', 'index.html') };
}

function applyUiEntry(win, entry) {
  if (entry.type === 'file') {
    void win.loadFile(entry.value);
  } else {
    void win.loadURL(entry.value);
  }
}

function loadUi(win) {
  void resolveUiEntry().then((entry) => applyUiEntry(win, entry));
}

/** Google OAuth için ayrı pencere — sistem tarayıcı sekmesi kapanmaz sorununu önler */
let oauthWindow = null;

function closeOAuthWindow() {
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    try {
      oauthWindow.close();
    } catch {
      /* ignore */
    }
  }
  oauthWindow = null;
}

function handleDeepLink(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith('dracord://')) return;
  closeOAuthWindow();
  const payload = rawUrl.replace(/^dracord:\/\//, '');
  const hash = `/auth/callback?electron=1&payload=${encodeURIComponent(payload)}`;
  if (mainWindow) {
    showMainWindow();
    void resolveUiEntry().then((entry) => {
      if (entry.type === 'file') {
        void mainWindow.loadFile(entry.value, { hash });
      } else {
        void mainWindow.loadURL(`${entry.value.replace(/\/$/, '')}/#${hash}`);
      }
    });
  }
}

/**
 * desktop-done veya dracord:// URL’sinden oturumu tamamla ve OAuth penceresini kapat.
 * @returns {boolean}
 */
function finishOAuthFromUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    if (urlString.startsWith('dracord://')) {
      handleDeepLink(urlString);
      return true;
    }
    const u = new URL(urlString);
    // Spotify OAuth tamamlandı — pencereyi kapat, ayarlar yenilesin
    if (
      u.pathname.includes('/oauth/spotify-done') ||
      (u.pathname.includes('/settings/connections') &&
        (u.searchParams.get('spotify') === 'ok' ||
          u.searchParams.get('spotify') === 'error'))
    ) {
      closeOAuthWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('oauth:spotify-done', {
          status: u.searchParams.get('status') || u.searchParams.get('spotify') || 'ok',
        });
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
      return true;
    }
    if (!u.pathname.includes('/auth/desktop-done')) return false;
    const q = new URLSearchParams();
    for (const key of [
      'accessToken',
      'refreshToken',
      'challengeToken',
      'error',
      'reason',
    ]) {
      const v = u.searchParams.get(key);
      if (v) q.set(key, v);
    }
    if ([...q.keys()].length === 0) return false;
    handleDeepLink(`dracord://oauth?${q.toString()}`);
    return true;
  } catch {
    return false;
  }
}

function openOAuthWindow(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 2048) {
    return { ok: false, error: 'invalid_url' };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'protocol' };
  }

  closeOAuthWindow();
  const icon = loadAppIcon();
  oauthWindow = new BrowserWindow({
    width: 560,
    height: 740,
    minWidth: 420,
    minHeight: 560,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#11131e',
    title: 'Dracord — Google ile giriş',
    ...(icon ? { icon } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const wc = oauthWindow.webContents;
  const onNav = (_event, url) => {
    if (finishOAuthFromUrl(url)) return;
  };
  wc.on('will-redirect', (event, url) => {
    if (
      url.startsWith('dracord://') ||
      url.includes('/auth/desktop-done') ||
      url.includes('/oauth/spotify-done')
    ) {
      event.preventDefault();
      finishOAuthFromUrl(url);
    }
  });
  wc.on('will-navigate', (event, url) => {
    if (url.startsWith('dracord://')) {
      event.preventDefault();
      finishOAuthFromUrl(url);
      return;
    }
    if (url.includes('/oauth/spotify-done')) {
      event.preventDefault();
      finishOAuthFromUrl(url);
      return;
    }
    if (url.includes('/auth/desktop-done')) {
      // Sayfa yüklensin diye engelleme; did-navigate ile kapat
    }
  });
  wc.on('did-navigate', onNav);
  wc.on('did-navigate-in-page', onNav);

  oauthWindow.on('closed', () => {
    oauthWindow = null;
  });

  void oauthWindow.loadURL(parsed.toString());
  return { ok: true };
}

/** Görünür tepsi ikonu — 1x1 şeffaf piksel Windows’ta “kaybolmuş” gibi durur */
function trayNativeImage() {
  const size = process.platform === 'darwin' ? 22 : 32;
  const base = loadAppIcon();
  if (base && !base.isEmpty()) {
    return base.resize({ width: size, height: size });
  }
  // 16x16 mor kare (Dracord tonu) — en kötü ihtimal görünür kalsın
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAANElEQVQ4T2NkYGD4z0ABYBzVMKoBBg0MDAz/GdH5o5pGNcCgAQwMDIz/8enHBaMaRjXA0AAAijIEAWd7r7QAAAAASUVORK5CYII=',
    'base64',
  );
  const img = nativeImage.createFromBuffer(png);
  return img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: size, height: size });
}

/** Gizli / küçültülmüş / ekran dışı pencereyi görev çubuğuna + öne getir */
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  try {
    // hide() görev çubuğundan düşürür — her zaman geri al
    mainWindow.setSkipTaskbar(false);
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();

    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const area = display?.workArea;
    if (area) {
      const onScreen =
        bounds.x + bounds.width > area.x + 40 &&
        bounds.y + bounds.height > area.y + 40 &&
        bounds.x < area.x + area.width - 40 &&
        bounds.y < area.y + area.height - 40;
      if (!onScreen) mainWindow.center();
    }

    mainWindow.show();
    mainWindow.focus();
    if (process.platform === 'win32') {
      // Windows bazen show() sonrası arkada bırakıyor
      mainWindow.setAlwaysOnTop(true);
      mainWindow.moveTop();
      mainWindow.setAlwaysOnTop(false);
      mainWindow.flashFrame(true);
      setTimeout(() => {
        try {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.flashFrame(false);
        } catch {
          /* ignore */
        }
      }, 1500);
    }
  } catch (err) {
    console.warn('[showMainWindow]', err);
    try {
      mainWindow.setSkipTaskbar(false);
      mainWindow.show();
      mainWindow.focus();
    } catch {
      /* ignore */
    }
  }
}

function createTray() {
  if (tray) return;
  tray = new Tray(trayNativeImage());
  tray.setToolTip('Dracord');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Göster',
        click: () => showMainWindow(),
      },
      {
        label: 'Çıkış',
        click: () => {
          trayEnabled = false;
          app.quit();
        },
      },
    ]),
  );
  // Windows: tek tık da göster (çift tık her zaman güvenilir değil)
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
}

function createWindow() {
  // File / Edit / View / Window menüsünü kaldır
  Menu.setApplicationMenu(null);

  const icon = loadAppIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: !frameless,
    titleBarStyle: frameless ? 'hidden' : 'default',
    autoHideMenuBar: true,
    backgroundColor: '#11131e',
    title: 'Dracord',
    // Hemen göster → Windows görev çubuğunda anında ikon
    show: true,
    skipTaskbar: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (icon && process.platform === 'darwin') {
    app.dock?.setIcon(icon);
  }

  // Odak / ekran-dışı düzeltme
  mainWindow.once('ready-to-show', () => showMainWindow());
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) showMainWindow();
  }, 800);

  loadUi(mainWindow);

  // Uygulama içi <a target=_blank> / window.open → sistem tarayıcısı
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Renderer crash / blank screen teşhisi (DRACORD_DEBUG=1)
  if (process.env.DRACORD_DEBUG === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.webContents.on('console-message', (event) => {
      console.log('[renderer]', event.message);
    });
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error('[did-fail-load]', code, desc, url);
    });
  }

  mainWindow.on('close', (e) => {
    if (trayEnabled && tray) {
      // hide() görev çubuğundan siler — minimize ile çubukta kalsın
      e.preventDefault();
      mainWindow.setSkipTaskbar(false);
      mainWindow.minimize();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createTray();
}

function registerProtocol() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('dracord', process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient('dracord');
  }
}

function registerWindowIpc() {
  ipcMain.handle('shell:open-external', async (_event, rawUrl) => {
    if (typeof rawUrl !== 'string' || rawUrl.length > 2048) {
      return { ok: false, error: 'invalid_url' };
    }
    // Spotify native: spotify:track:… (URL ctor bazı ortamlarda garip parse eder)
    if (/^spotify:[a-z]+:[a-zA-Z0-9]+/i.test(rawUrl.trim())) {
      try {
        await shell.openExternal(rawUrl.trim());
        return { ok: true };
      } catch (err) {
        console.warn('[shell:open-external] spotify', err);
        return { ok: false, error: 'open_failed' };
      }
    }
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { ok: false, error: 'invalid_url' };
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'protocol' };
    }
    try {
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch (err) {
      console.warn('[shell:open-external]', err);
      return { ok: false, error: 'open_failed' };
    }
  });

  ipcMain.handle('shell:open-oauth', async (_event, rawUrl) => {
    try {
      return openOAuthWindow(rawUrl);
    } catch (err) {
      console.warn('[shell:open-oauth]', err);
      return { ok: false, error: 'open_failed' };
    }
  });

  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (trayEnabled) {
      // hide() görev çubuğunu düşürüyordu — minimize ile kalsın
      win.setSkipTaskbar(false);
      win.minimize();
    } else {
      win.close();
    }
  });

  // Eski send API (geriye dönük)
  ipcMain.on('system-prefs', (_event, prefs) => {
    if (!prefs || typeof prefs !== 'object') return;
    applySystemPrefs(prefs);
  });

  ipcMain.handle('system-prefs:set', (_event, prefs) => {
    if (!prefs || typeof prefs !== 'object') {
      return { ok: false, error: 'invalid' };
    }
    const applied = applySystemPrefs(prefs);
    return { ok: true, ...applied };
  });

  /** Steam / Epic / manuel oyun algılama + kütüphane */
  const desktopGames = require('./desktop-games');
  ipcMain.handle('presence:detect-games', async () => {
    try {
      return await desktopGames.detectRunningGames();
    } catch (e) {
      return {
        ok: false,
        games: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
  ipcMain.handle('games:scan-library', async () => {
    try {
      return await desktopGames.scanGameLibrary();
    } catch (e) {
      return {
        ok: false,
        games: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
  ipcMain.handle('games:import-scan', async () => {
    try {
      return await desktopGames.importScanToRegistered();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle('games:get-registered', () => {
    try {
      return desktopGames.getRegistered();
    } catch (e) {
      return { ok: false, games: [], error: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle('games:add-manual', (_e, entry) => {
    try {
      return desktopGames.addManualGame(entry || {});
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle('games:remove', (_e, appId) => {
    try {
      return desktopGames.removeRegisteredGame(String(appId || ''));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle('games:set-enabled', (_e, payload) => {
    try {
      return desktopGames.setGameEnabled(
        String(payload?.appId || ''),
        Boolean(payload?.enabled),
      );
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle('games:pick-exe', async () => {
    try {
      const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
      const res = await dialog.showOpenDialog(win, {
        title: 'Oyun exe seç',
        filters: [{ name: 'Uygulama', extensions: ['exe'] }],
        properties: ['openFile'],
      });
      if (res.canceled || !res.filePaths?.[0]) {
        return { ok: false, canceled: true };
      }
      const exePath = res.filePaths[0];
      const name = path.basename(exePath, path.extname(exePath));
      return { ok: true, exePath, name };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('system-prefs:get', () => {
    const stored = readStoredSystemPrefs();
    return {
      ...stored,
      openAtLoginApplied: isOpenAtLoginEnabled(),
    };
  });
}

function registerDealerTtsIpc() {
  const { synthesizeDealerTts } = require('./dealer-tts');
  ipcMain.handle('dealer-tts:synthesize', async (_event, text) => {
    try {
      return await synthesizeDealerTts(text);
    } catch (err) {
      console.warn('[dealer-tts] ipc hata', err);
      return { ok: false, error: 'exception' };
    }
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((arg) => arg.startsWith('dracord://'));
    if (deepLink) handleDeepLink(deepLink);
    showMainWindow();
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.dracord.desktop');
    }
    // Kayıtlı “başlangıçta aç” tercihini OS’e yeniden uygula
    try {
      const stored = readStoredSystemPrefs();
      trayEnabled = stored.minimizeToTray;
      applyOpenAtLogin(stored.openOnStartup);
    } catch (err) {
      console.warn('[system-prefs] boot', err);
    }
    registerApiOriginBridge();
    registerMediaCaptureHandlers();
    registerDealerTtsIpc();
    registerProtocol();
    registerWindowIpc();
    // Sürüm IPC’sini pencere açılmadan kaydet (UI “…” takılı kalmasın)
    setupAutoUpdater();
    createWindow();

    app.on('activate', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
      } else {
        showMainWindow();
      }
    });
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    trayEnabled = false;
  });
}
