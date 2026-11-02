import type { Subtitle, SubtitleFormat } from '../types/subtitle'
import { timecodeToMs } from './timecode'

/** Build a fresh, untranslated subtitle with sane defaults. */
function makeSubtitle(
  fileId: string,
  id: number,
  startMs: number,
  endMs: number,
  start: string,
  end: string,
  original: string
): Subtitle {
  return {
    id,
    fileId,
    chunkId: null,
    start,
    end,
    startMs,
    endMs,
    original: original.trim(),
    translation: '',
    status: 'empty',
    confidence: null,
    cps: 0,
    cpsWarning: false,
    notes: ''
  }
}

function normalize(raw: string): string {
  // Strip UTF-8 BOM, unify line endings.
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

/** Detect the subtitle format from a filename extension and/or content. */
export function detectFormat(filename: string, content?: string): SubtitleFormat {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'vtt' || ext === 'srt' || ext === 'ass' || ext === 'ssa') return ext
  if (content && /^\uFEFF?WEBVTT/.test(content)) return 'vtt'
  if (content && /\[Script Info\]/i.test(content)) return 'ass'
  return 'srt'
}

const TIMECODE_LINE = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})/

/** Parse SRT or VTT (both are cue blocks separated by blank lines). */
function parseCueBlocks(content: string, fileId: string): Subtitle[] {
  const blocks = normalize(content).trim().split(/\n\s*\n+/)
  const subtitles: Subtitle[] = []
  let seq = 0

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    if (lines.length === 0) continue

    const timingIndex = lines.findIndex((l) => TIMECODE_LINE.test(l))
    if (timingIndex === -1) continue // header (WEBVTT) or NOTE block

    const match = lines[timingIndex].match(TIMECODE_LINE)
    if (!match) continue

    const text = lines.slice(timingIndex + 1).join('\n')
    seq += 1
    const startMs = timecodeToMs(match[1])
    const endMs = timecodeToMs(match[2])
    subtitles.push(makeSubtitle(fileId, seq, startMs, endMs, match[1].replace('.', ','), match[2].replace('.', ','), text))
  }

  return subtitles
}

const ASS_TIME = /(\d):(\d{2}):(\d{2})\.(\d{2})/
function assTimeToMs(tc: string): number {
  const m = tc.match(ASS_TIME)
  if (!m) return 0
  const [, h, min, s, cs] = m
  return (+h * 3600 + +min * 60 + +s) * 1000 + +cs * 10
}

/** Strip ASS/SSA override blocks and drawing commands, keep plain text. */
function stripAssTags(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N/gi, '\n')
    .replace(/\\h/gi, ' ')
    .trim()
}

function parseAss(content: string, fileId: string): Subtitle[] {
  const lines = normalize(content).split('\n')
  const eventsStart = lines.findIndex((l) => /^\[Events\]/i.test(l.trim()))
  if (eventsStart === -1) return []

  const formatLine = lines.slice(eventsStart).find((l) => /^Format:/i.test(l.trim()))
  const fields = formatLine
    ? formatLine.replace(/^Format:/i, '').split(',').map((f) => f.trim().toLowerCase())
    : ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text']
  const startCol = fields.indexOf('start')
  const endCol = fields.indexOf('end')
  const textCol = fields.indexOf('text')

  const subtitles: Subtitle[] = []
  let seq = 0
  for (const line of lines.slice(eventsStart)) {
    if (!/^Dialogue:/i.test(line.trim())) continue
    // Text is the last field and may itself contain commas, so split with a limit.
    const parts = line.replace(/^Dialogue:/i, '').split(',')
    const head = parts.slice(0, textCol)
    const text = parts.slice(textCol).join(',')
    const startMs = assTimeToMs(head[startCol] ?? '')
    const endMs = assTimeToMs(head[endCol] ?? '')
    const clean = stripAssTags(text)
    if (!clean) continue
    seq += 1
    subtitles.push(
      makeSubtitle(
        fileId,
        seq,
        startMs,
        endMs,
        head[startCol]?.trim() ?? '',
        head[endCol]?.trim() ?? '',
        clean
      )
    )
  }
  return subtitles
}

/** Parse any supported subtitle format into the internal flat representation. */
export function parseSubtitles(content: string, format: SubtitleFormat, fileId: string): Subtitle[] {
  if (format === 'ass' || format === 'ssa') return parseAss(content, fileId)
  return parseCueBlocks(content, fileId)
}
