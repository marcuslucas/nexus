const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexus', {
  checkHealth: () => ipcRenderer.invoke('server:health'),
  getConfig:   () => ipcRenderer.invoke('shell:getConfig'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
