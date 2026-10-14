const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isElectron: true,
});

contextBridge.exposeInMainWorld('dracordDesktop', {
  isElectron: true,
  setSystemPrefs: (prefs) => {
    ipcRenderer.send('system-prefs', prefs);
  },
  getDesktopSources: () => ipcRenderer.invoke('desktop-capturer:get-sources'),
  setDisplayMediaSelection: (selection) =>
    ipcRenderer.invoke('desktop-capturer:set-selection', selection),
  clearDisplayMediaSelection: () => ipcRenderer.invoke('desktop-capturer:clear-selection'),
  /** @param {string} text */
  synthesizeDealerTts: (text) => ipcRenderer.invoke('dealer-tts:synthesize', text),
});
