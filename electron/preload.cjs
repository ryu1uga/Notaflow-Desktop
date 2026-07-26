// Puente seguro entre el proceso principal y la interfaz.
// contextIsolation activo: la UI solo ve estas funciones, nada de Node.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notaflow', {
  store: {
    load: () => ipcRenderer.invoke('store:load'),
    save: (data) => ipcRenderer.invoke('store:save', data),
    path: () => ipcRenderer.invoke('store:path'),
  },
  backup: {
    export: (data) => ipcRenderer.invoke('backup:export', data),
    import: () => ipcRenderer.invoke('backup:import'),
    reveal: (filePath) => ipcRenderer.invoke('backup:reveal', filePath),
  },
  notify: {
    schedule: (items) => ipcRenderer.invoke('notify:schedule', items),
    test: () => ipcRenderer.invoke('notify:test'),
    supported: () => ipcRenderer.invoke('notify:supported'),
  },
  platform: process.platform,
})
