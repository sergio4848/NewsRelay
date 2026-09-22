import { contextBridge, ipcRenderer } from 'electron';
import { type DesktopBridge, type Snapshot } from '../core/model';
const bridge: DesktopBridge = {
  license: (request) => ipcRenderer.invoke('license', request),
  contact: (id) => ipcRenderer.invoke('contact', id),
  snapshot: () => ipcRenderer.invoke('snapshot'),
  command: (command) => ipcRenderer.invoke('command', command),
  saveConfig: (config) => ipcRenderer.invoke('saveConfig', config),
  credential: (id, value) => ipcRenderer.invoke('credential', id, value),
  poll: () => ipcRenderer.invoke('poll'),
  media: (id) => ipcRenderer.invoke('media', id),
  demo: (value) => ipcRenderer.invoke('demo', value),
  copyOutput: (test) => ipcRenderer.invoke('copyOutput', test),
  copyWebhook: (id) => ipcRenderer.invoke('copyWebhook', id),
  transfer: (action) => ipcRenderer.invoke('transfer', action),
  subscribe: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, state: Snapshot) => listener(state);
    ipcRenderer.on('state', receive);
    return () => ipcRenderer.removeListener('state', receive);
  },
};
contextBridge.exposeInMainWorld('newsrelay', bridge);
