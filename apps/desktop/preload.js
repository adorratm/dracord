const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isElectron: true,
});

contextBridge.exposeInMainWorld('dracordDesktop', {
  isElectron: true,
  /** OS başlangıç / tepsi tercihlerini main process’e uygula */
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
});
