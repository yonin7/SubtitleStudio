import type { AIRequest, AIResponse, AIProviderState, AiNotice, ApiKeyInfo, KeyProviderId } from './ai'
import type { AppSettings } from './settings'
import type { ContentDetection, MetadataResult } from './metadata'
import type { SessionData } from './session'

/**
 * Single source of truth for IPC channel names, shared by main and preload
 * so the two can never drift apart.
 */
export const IPC = {
  openFile: 'dialog:openFile',
  saveFile: 'dialog:saveFile',
  readFile: 'file:read',
  writeFile: 'file:write',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  resetSettings: 'settings:reset',
  callAI: 'api:call',
  providerStatus: 'api:status',
  aiNotice: 'api:notice',
  getApiKeys: 'api:keys:get',
  addApiKey: 'api:keys:add',
  removeApiKey: 'api:keys:remove',
  lookupCharacters: 'metadata:lookup',
  saveSession: 'session:save',
  loadSession: 'session:load',
  clearSession: 'session:clear',
  openExternal: 'shell:openExternal',
  appVersion: 'app:version'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export interface OpenFileResult {
  canceled: boolean
  path: string | null
}

export interface SaveFileResult {
  canceled: boolean
  path: string | null
}

export interface ReadFileResult {
  content: string
  encoding: string
}

/**
 * The exact API surface exposed to the renderer via the context bridge.
 * Implemented in preload, consumed (typed) on `window.electronAPI`.
 */
export interface ElectronAPI {
  // File system
  openFileDialog(): Promise<OpenFileResult>
  saveFileDialog(defaultName?: string): Promise<SaveFileResult>
  readSubtitleFile(path: string): Promise<ReadFileResult>
  writeFile(path: string, content: string, addBom?: boolean): Promise<void>

  // Settings
  getSettings(): Promise<AppSettings>
  saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  resetSettings(): Promise<AppSettings>

  // AI (keys live only in the main process)
  callAI(request: AIRequest): Promise<AIResponse>
  getProviderStatus(): Promise<AIProviderState[]>
  /** Subscribe to transient AI notices (cooldown waits). Returns an unsubscribe. */
  onAiNotice(callback: (notice: AiNotice) => void): () => void

  // API key management (full keys stay in the main process; UI sees masked only)
  getApiKeys(): Promise<ApiKeyInfo[]>
  addApiKey(provider: KeyProviderId, key: string): Promise<ApiKeyInfo[]>
  removeApiKey(provider: KeyProviderId, index: number): Promise<ApiKeyInfo[]>

  // Character metadata lookup (runs entirely in the main process)
  lookupCharacters(detection: ContentDetection): Promise<MetadataResult>

  // Session persistence / resume
  saveSession(originalPath: string, data: SessionData): Promise<void>
  loadSession(originalPath: string): Promise<SessionData | null>
  clearSession(originalPath: string): Promise<void>

  // Shell / app
  openExternal(url: string): Promise<void>
  getAppVersion(): Promise<string>
}
