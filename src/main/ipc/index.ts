import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import { IPC } from '@shared/types'
import type { AIRequest, AppSettings, KeyProviderId } from '@shared/types'
import type { ContentDetection, SessionData } from '@shared/types'
import { getSettings, saveSettings, resetSettings } from '../services/settingsStore'
import { readSubtitleFile, writeTextFile } from '../services/fileService'
import { callAI, getProviderStatus, resetProviderQuota } from '../services/ai/apiManager'
import * as keyVault from '../services/ai/keyVault'
import { lookupCharacters } from '../services/metadata/metadataManager'
import { saveSession, loadSession, clearSession } from '../services/sessionService'

const SUBTITLE_FILTERS = [
  { name: 'Subtitles', extensions: ['srt', 'vtt', 'ass', 'ssa'] },
  { name: 'All Files', extensions: ['*'] }
]

/** Wire every IPC channel to its service. Called once on app ready. */
export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.openFile, async () => {
    const win = getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile'], filters: SUBTITLE_FILTERS })
      : await dialog.showOpenDialog({ properties: ['openFile'], filters: SUBTITLE_FILTERS })
    return { canceled: result.canceled, path: result.filePaths[0] ?? null }
  })

  ipcMain.handle(IPC.saveFile, async (_e, defaultName?: string) => {
    const win = getWindow()
    const opts = { defaultPath: defaultName, filters: SUBTITLE_FILTERS }
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    return { canceled: result.canceled, path: result.filePath ?? null }
  })

  ipcMain.handle(IPC.readFile, (_e, path: string) => readSubtitleFile(path))

  ipcMain.handle(IPC.writeFile, (_e, path: string, content: string, addBom?: boolean) =>
    writeTextFile(path, content, addBom)
  )

  ipcMain.handle(IPC.getSettings, () => getSettings())
  ipcMain.handle(IPC.saveSettings, (_e, patch: Partial<AppSettings>) => saveSettings(patch))
  ipcMain.handle(IPC.resetSettings, () => resetSettings())

  ipcMain.handle(IPC.callAI, (e, request: AIRequest) =>
    callAI(request, { onNotice: (notice) => e.sender.send(IPC.aiNotice, notice) })
  )
  ipcMain.handle(IPC.providerStatus, () => getProviderStatus())

  ipcMain.handle(IPC.getApiKeys, () => keyVault.info())
  ipcMain.handle(IPC.addApiKey, (_e, provider: KeyProviderId, key: string) => {
    keyVault.addKey(provider, key)
    resetProviderQuota(provider)
    return keyVault.info()
  })
  ipcMain.handle(IPC.removeApiKey, (_e, provider: KeyProviderId, index: number) => {
    keyVault.removeKey(provider, index)
    resetProviderQuota(provider)
    return keyVault.info()
  })

  ipcMain.handle(IPC.lookupCharacters, (_e, detection: ContentDetection) =>
    lookupCharacters(detection)
  )

  ipcMain.handle(IPC.saveSession, (_e, originalPath: string, data: SessionData) =>
    saveSession(originalPath, data)
  )
  ipcMain.handle(IPC.loadSession, (_e, originalPath: string) => loadSession(originalPath))
  ipcMain.handle(IPC.clearSession, (_e, originalPath: string) => clearSession(originalPath))

  ipcMain.handle(IPC.openExternal, (_e, url: string) => shell.openExternal(url))
  ipcMain.handle(IPC.appVersion, () => app.getVersion())
}
