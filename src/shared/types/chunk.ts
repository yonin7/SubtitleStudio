export type ChunkStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'paused'

/**
 * An atomic translation unit. Holds index ranges into the flat subtitle
 * array rather than copies of the subtitles themselves.
 */
export interface Chunk {
  id: number
  fileId: string
  /** Inclusive indices into the file's subtitle array. */
  startIndex: number
  endIndex: number
  status: ChunkStatus
  translatedCount: number
  totalCount: number
  retryCount: number
  confidence: number | null
  error: string | null
  /** ISO timestamp of completion, or null. */
  completedAt: string | null
}

/**
 * Continuity information passed to a translator agent so each chunk flows
 * naturally from the previous one. Built fresh per chunk.
 */
export interface ContextBridge {
  /** Last N translated lines from the previous chunk. */
  prevContext: { id: number; original: string; translated: string }[]
  /** First M untranslated lines from the next chunk (flow only, do not translate). */
  nextPreview: { id: number; original: string }[]
  /** Last identifiable speaking character, if any. */
  activeSpeaker: string | null
  sceneChanged: boolean
}

export type QueueBucket =
  | 'pending'
  | 'priority'
  | 'completed'
  | 'failed'
  | 'skipped'

export interface TranslationQueueState {
  pending: number[]
  priority: number[]
  active: number | null
  completed: number[]
  failed: number[]
  skipped: number[]
  paused: boolean
  startedAt: string | null
}
