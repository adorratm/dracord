const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const isDev =
  process.env.NODE_ENV !== 'production' || process.env.DRACORD_ELECTRON_DEV === '1';

const appUrl =
  process.env.DRACORD_APP_URL ||
  (isDev ? 'http://localhost:3000' : 'https://dracord.com.tr');

const frameless = process.env.DRACORD_FRAMELESS === 'true';

/** @type {BrowserWindow | null} */
let mainWindow = null;

function resolveAppUrlFromDeepLink(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith('dracord://')) {
    return null;
  }
  // dracord://oauth?accessToken=…&refreshToken=… → web /auth/callback
  const payload = rawUrl.replace(/^dracord:\/\//, '');
  const base = appUrl.replace(/\/$/, '');
  return `${base}/auth/callback?electron=1&payload=${encodeURIComponent(payload)}`;
}

function handleDeepLink(rawUrl) {
  const target = resolveAppUrlFromDeepLink(rawUrl);
  if (!target) return;
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    void mainWindow.loadURL(target);
  } else {
    shell.openExternal(target);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: !frameless,
    titleBarStyle: frameless ? 'hidden' : 'default',
    backgroundColor: '#282a36',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  void mainWindow.loadURL(appUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
    // minimizeToTray tercihini web gönderir; yoksa kapat
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

/** @type {boolean} */
let trayEnabled = true;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((arg) => arg.startsWith('dracord://'));
    if (deepLink) handleDeepLink(deepLink);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerProtocol();
    registerWindowIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
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
}
