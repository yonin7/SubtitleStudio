import type { AIProviderId } from './types/ai'
import type { ContentType } from './types/metadata'
import type { AppSettings } from './types/settings'

/**
 * Recommended chunk sizes by content type (subtitles per chunk).
 * Larger chunks mean fewer API calls (less quota pressure) AND fewer "seams"
 * between chunks, which improves cross-line coherence. Modern long-context
 * models handle 40-50 lines comfortably alongside the Context Bridge.
 */
export const CHUNK_SIZE_BY_CONTENT: Record<ContentType | 'default', number> = {
  movie: 40,
  documentary: 45,
  anime: 35,
  animation: 35,
  series: 40,
  other: 40,
  default: 40
}

/** Hebrew subtitle line constraints. */
export const MAX_LINE_LENGTH = 42
export const MAX_LINES_PER_SUBTITLE = 2
export const MAX_TOTAL_LENGTH = MAX_LINE_LENGTH * MAX_LINES_PER_SUBTITLE

/** A gap larger than this between lines is treated as a scene break. */
export const SCENE_BREAK_GAP_MS = 3000

/** Continuity context sizes for the chunk bridge. */
export const CONTEXT_BRIDGE_SIZE = 5
export const PREVIEW_BRIDGE_SIZE = 3

/** Readability thresholds. */
export const DEFAULT_MAX_CPS = 20
export const MIN_SUBTITLE_DURATION_MS = 800
export const MIN_GAP_MS = 50

/** Provider order used when building the fallback chain. */
export const DEFAULT_FALLBACK_ORDER: AIProviderId[] = [
  'gemini-flash-lite',
  'groq',
  'gemini-flash'
]

/** Safety ceiling: never send more than this many lines to the AI in one call. */
export const MAX_SUBTITLES_PER_REQUEST = 60

export const DEFAULT_SETTINGS: AppSettings = {
  api: {
    preferredProvider: 'gemini-flash-lite',
    fallbackEnabled: true,
    batchDelay: 1500,
    maxRetries: 3
  },
  translation: {
    defaultSourceLang: 'auto',
    defaultTargetLang: 'he',
    defaultContentType: 'auto',
    defaultFormality: 'balanced',
    defaultTone: 'neutral',
    runDirectorAgent: true,
    runReviewerAgent: false,
    reviewerFrequency: 5
  },
  chunks: {
    defaultChunkSize: 40,
    respectSceneBreaks: true,
    contextBridgeSize: CONTEXT_BRIDGE_SIZE,
    previewBridgeSize: PREVIEW_BRIDGE_SIZE
  },
  character: {
    autoLookup: true,
    preferredAnimeSource: 'anilist',
    showActorPhotos: true,
    requireManualConfirmation: true
  },
  editor: {
    theme: 'dark',
    fontSize: 14,
    showConfidenceScores: true,
    showCpsWarnings: true,
    autoSave: true,
    autoSaveInterval: 30,
    undoHistoryLimit: 50
  },
  export: {
    defaultFormat: 'srt',
    defaultContent: 'translation',
    addBom: false,
    rtlOverride: true,
    outputTemplate: '{name}_HEB'
  },
  ui: {
    defaultEditorMode: 'standard',
    language: 'en',
    showKeyboardShortcuts: true
  }
}
