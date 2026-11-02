import type { Subtitle } from '../types/subtitle'
import { MIN_GAP_MS, MIN_SUBTITLE_DURATION_MS, DEFAULT_MAX_CPS } from '../constants'

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

/**
 * Parse an SRT ("00:01:23,456") or VTT ("00:01:23.456") timecode to milliseconds.
 * Also tolerates a missing hours component ("01:23,456").
 */
export function timecodeToMs(tc: string): number {
  const trimmed = tc.trim().replace('.', ',')
  const [time, ms = '0'] = trimmed.split(',')
  const parts = time.split(':').map(Number)
  let h = 0
  let m = 0
  let s = 0
  if (parts.length === 3) [h, m, s] = parts
  else if (parts.length === 2) [m, s] = parts
  else [s] = parts
  return (h * 3600 + m * 60 + s) * 1000 + parseInt(ms.padEnd(3, '0').slice(0, 3), 10)
}

/** Format milliseconds as an SRT timecode ("00:01:23,456"). */
export function msToTimecode(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const h = Math.floor(safe / 3600000)
  const m = Math.floor((safe % 3600000) / 60000)
  const s = Math.floor((safe % 60000) / 1000)
  const rem = safe % 1000
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(rem, 3)}`
}

/** Format milliseconds as a VTT timecode ("00:01:23.456"). */
export function msToVttTimecode(ms: number): string {
  return msToTimecode(ms).replace(',', '.')
}

/** Format milliseconds as a human duration ("01:42:30"). */
export function msToDuration(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const h = Math.floor(safe / 3600000)
  const m = Math.floor((safe % 3600000) / 60000)
  const s = Math.floor((safe % 60000) / 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** Recompute the timecode strings of a subtitle from its ms fields. */
function withTimecodes(sub: Subtitle, startMs: number, endMs: number): Subtitle {
  const start = Math.max(0, startMs)
  const end = Math.max(0, endMs)
  return { ...sub, startMs: start, endMs: end, start: msToTimecode(start), end: msToTimecode(end) }
}

/** Shift subtitles by an offset (ms), optionally only from a given index. */
export function shiftSubtitles(subtitles: Subtitle[], offsetMs: number, fromIndex = 0): Subtitle[] {
  return subtitles.map((sub, i) =>
    i < fromIndex ? sub : withTimecodes(sub, sub.startMs + offsetMs, sub.endMs + offsetMs)
  )
}

/**
 * Linearly scale subtitle timings by a factor (e.g. framerate conversion
 * 23.976→25 ≈ 0.95904). An optional anchor (ms) stays fixed during scaling.
 */
export function scaleSubtitles(subtitles: Subtitle[], factor: number, anchorMs = 0): Subtitle[] {
  if (!Number.isFinite(factor) || factor <= 0) return subtitles
  return subtitles.map((sub) =>
    withTimecodes(
      sub,
      anchorMs + (sub.startMs - anchorMs) * factor,
      anchorMs + (sub.endMs - anchorMs) * factor
    )
  )
}

/** Trim the end of any subtitle that overlaps the next one. */
export function fixOverlaps(subtitles: Subtitle[], gapMs = MIN_GAP_MS): Subtitle[] {
  return subtitles.map((sub, i) => {
    const next = subtitles[i + 1]
    if (!next) return sub
    if (sub.endMs >= next.startMs) {
      return withTimecodes(sub, sub.startMs, Math.max(sub.startMs, next.startMs - gapMs))
    }
    return sub
  })
}

/** Extend subtitles shorter than the minimum readable duration. */
export function fixShortDurations(subtitles: Subtitle[], minMs = MIN_SUBTITLE_DURATION_MS): Subtitle[] {
  return subtitles.map((sub) =>
    sub.endMs - sub.startMs < minMs ? withTimecodes(sub, sub.startMs, sub.startMs + minMs) : sub
  )
}

/** Compute characters-per-second and flag subtitles exceeding the limit. */
export function computeCps(sub: Subtitle, maxCps = DEFAULT_MAX_CPS): { cps: number; cpsWarning: boolean } {
  const seconds = (sub.endMs - sub.startMs) / 1000
  const text = sub.translation || sub.original
  const cps = seconds > 0 ? Math.round(text.replace(/\s/g, '').length / seconds) : 0
  return { cps, cpsWarning: cps > maxCps }
}
