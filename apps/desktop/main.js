const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeImage,
  session,
  desktopCapturer,
  systemPreferences,
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

/**
 * Renderer origin (localhost:5173 / file://) prod CORS allowlist'te değil → Failed to fetch.
 * API isteklerinde Origin'i web istemcisi gibi gönder.
 */
function registerApiOriginBridge() {
  const filter = {
    urls: [
      'https://api.dracord.com.tr/*',
      'http://localhost:4000/*',
      'http://127.0.0.1:4000/*',
    ],
  };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        Origin: 'https://dracord.com.tr',
      },
    });
  });
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

function handleDeepLink(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith('dracord://')) return;
  const payload = rawUrl.replace(/^dracord:\/\//, '');
  const hash = `/auth/callback?electron=1&payload=${encodeURIComponent(payload)}`;
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    void resolveUiEntry().then((entry) => {
      if (entry.type === 'file') {
        void mainWindow.loadFile(entry.value, { hash });
      } else {
        void mainWindow.loadURL(`${entry.value.replace(/\/$/, '')}/#${hash}`);
      }
    });
  }
}

function createTray() {
  if (tray) return;
  const base = loadAppIcon() ?? nativeImage.createEmpty();
  const trayImg = base.isEmpty()
    ? nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      )
    : base.resize({
        width: process.platform === 'darwin' ? 22 : 32,
        height: process.platform === 'darwin' ? 22 : 32,
      });
  tray = new Tray(trayImg);
  tray.setToolTip('Dracord');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Göster',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else createWindow();
        },
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
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
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

  loadUi(mainWindow);

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
      e.preventDefault();
      mainWindow.hide();
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
      win.hide();
    } else {
      win.close();
    }
  });

  ipcMain.on('system-prefs', (_event, prefs) => {
    if (!prefs || typeof prefs !== 'object') return;
    try {
      app.setLoginItemSettings({
        openAtLogin: Boolean(prefs.openOnStartup),
        openAsHidden: false,
      });
    } catch {
      // platform desteklemeyebilir
    }
    trayEnabled = Boolean(prefs.minimizeToTray);
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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.dracord.desktop');
    }
    registerApiOriginBridge();
    registerMediaCaptureHandlers();
    registerDealerTtsIpc();
    registerProtocol();
    registerWindowIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.show();
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
