import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '@shared/types'
import type { AiNotice, ElectronAPI } from '@shared/types'

const api: ElectronAPI = {
  openFileDialog: () => ipcRenderer.invoke(IPC.openFile),
  saveFileDialog: (defaultName) => ipcRenderer.invoke(IPC.saveFile, defaultName),
  readSubtitleFile: (path) => ipcRenderer.invoke(IPC.readFile, path),
  writeFile: (path, content, addBom) => ipcRenderer.invoke(IPC.writeFile, path, content, addBom),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (patch) => ipcRenderer.invoke(IPC.saveSettings, patch),
  resetSettings: () => ipcRenderer.invoke(IPC.resetSettings),
  callAI: (request) => ipcRenderer.invoke(IPC.callAI, request),
  getProviderStatus: () => ipcRenderer.invoke(IPC.providerStatus),
  onAiNotice: (callback) => {
    const listener = (_e: IpcRendererEvent, notice: AiNotice): void => callback(notice)
    ipcRenderer.on(IPC.aiNotice, listener)
    return () => ipcRenderer.removeListener(IPC.aiNotice, listener)
  },
  getApiKeys: () => ipcRenderer.invoke(IPC.getApiKeys),
  addApiKey: (provider, key) => ipcRenderer.invoke(IPC.addApiKey, provider, key),
  removeApiKey: (provider, index) => ipcRenderer.invoke(IPC.removeApiKey, provider, index),
  lookupCharacters: (detection) => ipcRenderer.invoke(IPC.lookupCharacters, detection),
  saveSession: (originalPath, data) => ipcRenderer.invoke(IPC.saveSession, originalPath, data),
  loadSession: (originalPath) => ipcRenderer.invoke(IPC.loadSession, originalPath),
  clearSession: (originalPath) => ipcRenderer.invoke(IPC.clearSession, originalPath),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  getAppVersion: () => ipcRenderer.invoke(IPC.appVersion)
}

contextBridge.exposeInMainWorld('electronAPI', api)
