const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings API
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
  openSettings: () => ipcRenderer.send('open-settings'),
  closeSettings: () => ipcRenderer.send('close-settings'),
  restartApp: () => ipcRenderer.send('restart-app'),
});
