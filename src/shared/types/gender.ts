/** Grammatical gender signal used for Hebrew conjugation. */
export type GenderTag = 'm' | 'f' | 'neutral' | 'unknown'

/** Minimal timing row from a reference file (for sync-by-overlap). */
export interface RefTiming {
  startMs: number
  endMs: number
}

/**
 * A per-line gender signal extracted from a parallel gendered-language
 * reference subtitle (e.g. Arabic / Spanish / French). Many languages mark
 * the speaker's and the addressee's gender grammatically, which English hides —
 * so a time-aligned reference disambiguates Hebrew gender per line.
 */
export interface GenderCue {
  /** Id of the reference subtitle this cue came from. */
  refId: number
  startMs: number
  endMs: number
  /** Gender of the person speaking the line (first-person agreement). */
  speaker: GenderTag
  /** Gender of the person being addressed (second-person agreement). */
  addressee: GenderTag
  /** Source line text, kept for review/inspection. */
  text?: string
}

/**
 * A parallel gendered-language subtitle file loaded purely as a gender
 * reference. Its timings/text never become the output — only the extracted
 * cues feed the translator.
 */
export interface GenderReference {
  filename: string
  /** Language of the reference, or "auto" when detected by the extractor. */
  language: string
  /** Number of lines in the reference file. */
  totalLines: number
  /** Per-line extracted gender cues, sorted by time. */
  cues: GenderCue[]
  /** Reference timecodes used when Sync adopts timings from the reference file. */
  timings: RefTiming[]
}
