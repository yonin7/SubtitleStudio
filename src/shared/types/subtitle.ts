/** Lifecycle status of a single subtitle line. */
export type SubtitleStatus =
  | 'empty'
  | 'ai_translated'
  | 'manual'
  | 'reviewed'
  | 'skipped'

export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa'

/**
 * The single source of truth for one subtitle line.
 * Subtitles live in one flat array; chunks reference them by index range,
 * so translation data is never duplicated.
 */
export interface Subtitle {
  /** 1-based sequence number as it appears in the source file. */
  id: number
  fileId: string
  /** Chunk this subtitle belongs to, or null before chunking. */
  chunkId: number | null
  /** Timecode strings, e.g. "00:00:05,000". */
  start: string
  end: string
  startMs: number
  endMs: number
  original: string
  translation: string
  status: SubtitleStatus
  /** AI confidence 0..1, or null when not provided. */
  confidence: number | null
  /** Characters-per-second of the current translation. */
  cps: number
  cpsWarning: boolean
  notes: string
}

/** Metadata describing a loaded subtitle file. */
export interface SubtitleFile {
  id: string
  filename: string
  originalPath: string
  language: string
  format: SubtitleFormat
  encoding: string
  totalSubtitles: number
  totalChunks: number
  /** Total runtime derived from the last subtitle, e.g. "01:42:30". */
  duration: string
}
