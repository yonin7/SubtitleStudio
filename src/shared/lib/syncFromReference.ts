import type { Subtitle } from '../types/subtitle'
import type { RefTiming } from '../types/gender'
import { msToTimecode } from './timecode'

function withMs(sub: Subtitle, startMs: number, endMs: number): Subtitle {
  const start = Math.max(0, startMs)
  const end = Math.max(start, endMs)
  return {
    ...sub,
    startMs: start,
    endMs: end,
    start: msToTimecode(start),
    end: msToTimecode(end)
  }
}

/**
 * Copy timecodes from a reference subtitle track onto the primary track by
 * temporal overlap (largest overlap wins per primary line). Unmatched primary
 * lines keep their original timings.
 */
export function applyReferenceTimings(
  primary: Subtitle[],
  refTimings: RefTiming[]
): { subtitles: Subtitle[]; matched: number } {
  if (!refTimings.length || !primary.length) {
    return { subtitles: primary, matched: 0 }
  }

  const sorted = [...refTimings].sort((a, b) => a.startMs - b.startMs)
  let windowStart = 0
  let matched = 0

  const result = primary.map((sub) => {
    while (windowStart < sorted.length && sorted[windowStart].endMs <= sub.startMs) {
      windowStart++
    }

    let best: RefTiming | null = null
    let bestOverlap = 0
    for (let i = windowStart; i < sorted.length && sorted[i].startMs < sub.endMs; i++) {
      const ref = sorted[i]
      const overlap = Math.min(sub.endMs, ref.endMs) - Math.max(sub.startMs, ref.startMs)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = ref
      }
    }

    if (!best || bestOverlap <= 0) return sub
    matched++
    return withMs(sub, best.startMs, best.endMs)
  })

  return { subtitles: result, matched }
}
