const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isElectron: true,
});

contextBridge.exposeInMainWorld('dracordDesktop', {
  isElectron: true,
  /** OS başlangıç / tepsi / autoUpdate tercihlerini main process’e uygula */
  setSystemPrefs: (prefs) => ipcRenderer.invoke('system-prefs:set', prefs),
  getSystemPrefs: () => ipcRenderer.invoke('system-prefs:get'),
  /** Genel harici link */
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  /** Google OAuth — kapatılabilir Electron penceresi (sistem sekmesi kapanmaz) */
  openOAuth: (url) => ipcRenderer.invoke('shell:open-oauth', url),
  getDesktopSources: () => ipcRenderer.invoke('desktop-capturer:get-sources'),
  setDisplayMediaSelection: (selection) =>
    ipcRenderer.invoke('desktop-capturer:set-selection', selection),
  clearDisplayMediaSelection: () => ipcRenderer.invoke('desktop-capturer:clear-selection'),
  /** @param {string} text */
  synthesizeDealerTts: (text) => ipcRenderer.invoke('dealer-tts:synthesize', text),
  /** Uygulama sürümü (paketli) */
  getAppVersion: () => ipcRenderer.invoke('updater:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  },
  /** Çalışan oyunları algıla (Steam / Epic / manuel) */
  detectGames: () => ipcRenderer.invoke('presence:detect-games'),
  /** Steam + Epic kütüphane taraması */
  scanGameLibrary: () => ipcRenderer.invoke('games:scan-library'),
  /** Taramayı kayıtlı listeye aktar */
  importGameScan: () => ipcRenderer.invoke('games:import-scan'),
  getRegisteredGames: () => ipcRenderer.invoke('games:get-registered'),
  addManualGame: (entry) => ipcRenderer.invoke('games:add-manual', entry),
  renameRegisteredGame: (appId, name) =>
    ipcRenderer.invoke('games:rename', { appId, name }),
  removeRegisteredGame: (appId) => ipcRenderer.invoke('games:remove', appId),
  setGameEnabled: (appId, enabled) =>
    ipcRenderer.invoke('games:set-enabled', { appId, enabled }),
  /** Exe seç → ikon çıkar → listeye ekle */
  pickGameExe: () => ipcRenderer.invoke('games:pick-exe'),
  /** Spotify OAuth penceresi kapandı */
  onSpotifyOAuthDone: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('oauth:spotify-done', handler);
    return () => ipcRenderer.removeListener('oauth:spotify-done', handler);
  },
});
