const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dracordOverlay', {
  toggleMute: () => ipcRenderer.invoke('overlay:voice-toggle', 'mute'),
  toggleDeafen: () => ipcRenderer.invoke('overlay:voice-toggle', 'deafen'),
  showMain: () => ipcRenderer.invoke('overlay:show-main'),
  sendQuickChat: (text) => ipcRenderer.invoke('overlay:quick-chat', text),
  onState: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('overlay:state', handler);
    return () => ipcRenderer.removeListener('overlay:state', handler);
  },
});
