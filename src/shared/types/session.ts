import type { ChunkStatus } from './chunk'
import type { GenderReference } from './gender'
import type { Glossary, StyleGuide } from './glossary'
import type { ContentDetection } from './metadata'
import type { SubtitleStatus } from './subtitle'

/** Minimal per-subtitle translation state persisted for resume. */
export interface SessionSubtitle {
  id: number
  translation: string
  status: SubtitleStatus
  confidence: number | null
}

export interface SessionChunk {
  id: number
  status: ChunkStatus
  completedAt: string | null
  error: string | null
}

/** Everything needed to resume an in-progress translation from disk. */
export interface SessionData {
  version: string
  filename: string
  totalSubtitles: number
  totalChunks: number
  updatedAt: string
  detection: ContentDetection | null
  glossary: Glossary | null
  styleGuide: StyleGuide | null
  /** Parallel gendered-language reference + extracted cues, when loaded. */
  genderReference: GenderReference | null
  chunks: SessionChunk[]
  subtitles: SessionSubtitle[]
}
