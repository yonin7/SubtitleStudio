import type { Subtitle } from '../types/subtitle'
import type { GenderCue } from '../types/gender'

/** True when a cue carries any usable (non-unknown) gender signal. */
export function cueHasSignal(cue: GenderCue): boolean {
  return cue.speaker !== 'unknown' || cue.addressee !== 'unknown'
}

/**
 * Align gendered-language reference cues to the primary subtitles by time
 * overlap. For each primary subtitle, picks the cue with the largest temporal
 * overlap that actually carries a gender signal. Returns a map of primary
 * subtitle id -> best matching cue. Both inputs are assumed time-ordered.
 */
export function alignGenderCues(primary: Subtitle[], cues: GenderCue[]): Map<number, GenderCue> {
  const result = new Map<number, GenderCue>()
  if (!cues.length || !primary.length) return result

  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs)
  let windowStart = 0

  for (const sub of primary) {
    // Drop cues that end before this subtitle begins (primary is ordered, so
    // they can't match any later subtitle either).
    while (windowStart < sorted.length && sorted[windowStart].endMs <= sub.startMs) {
      windowStart++
    }

    let best: GenderCue | null = null
    let bestOverlap = 0
    for (let i = windowStart; i < sorted.length && sorted[i].startMs < sub.endMs; i++) {
      const cue = sorted[i]
      if (!cueHasSignal(cue)) continue
      const overlap = Math.min(sub.endMs, cue.endMs) - Math.max(sub.startMs, cue.startMs)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = cue
      }
    }

    if (best) result.set(sub.id, best)
  }

  return result
}
