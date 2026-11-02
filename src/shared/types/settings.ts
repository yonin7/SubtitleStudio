import type { AIProviderId } from './ai'

export interface AppSettings {
  api: {
    preferredProvider: AIProviderId
    fallbackEnabled: boolean
    batchDelay: number
    maxRetries: number
  }
  translation: {
    defaultSourceLang: string
    defaultTargetLang: string
    defaultContentType: string
    defaultFormality: string
    defaultTone: string
    runDirectorAgent: boolean
    runReviewerAgent: boolean
    reviewerFrequency: number
  }
  chunks: {
    defaultChunkSize: number
    respectSceneBreaks: boolean
    contextBridgeSize: number
    previewBridgeSize: number
  }
  character: {
    autoLookup: boolean
    preferredAnimeSource: 'anilist' | 'jikan'
    showActorPhotos: boolean
    requireManualConfirmation: boolean
  }
  editor: {
    theme: 'dark' | 'light'
    fontSize: number
    showConfidenceScores: boolean
    showCpsWarnings: boolean
    autoSave: boolean
    autoSaveInterval: number
    undoHistoryLimit: number
  }
  export: {
    defaultFormat: ExportFormat
    defaultContent: ExportContent
    addBom: boolean
    rtlOverride: boolean
    outputTemplate: string
  }
  ui: {
    defaultEditorMode: EditorMode
    language: 'he' | 'en'
    showKeyboardShortcuts: boolean
  }
}

export type EditorMode = 'quick' | 'standard' | 'expert'

export type ExportFormat = 'srt' | 'vtt' | 'txt' | 'csv' | 'json'
export type ExportContent = 'translation' | 'original' | 'bilingual'
export type ExportEncoding = 'utf-8' | 'utf-8-bom'
export type ExportLineNumbering = 'original' | 'recount'

export interface ExportSettings {
  format: ExportFormat
  content: ExportContent
  encoding: ExportEncoding
  rtlOverride: boolean
  lineNumbering: ExportLineNumbering
  includeNotes: boolean
  outputTemplate: string
  skipEmptyTranslations: boolean
}
