import type { Subtitle } from '../types/subtitle'
import type { ExportContent, ExportSettings } from '../types/settings'
import { msToVttTimecode } from './timecode'

const RLM = '\u200F' // Right-to-left mark

function pickText(sub: Subtitle, content: ExportContent): string {
  if (content === 'original') return sub.original
  if (content === 'bilingual') return `${sub.original}\n${sub.translation}`.trim()
  return sub.translation || sub.original
}

function applyRtl(text: string, rtlOverride: boolean): string {
  if (!rtlOverride) return text
  return text
    .split('\n')
    .map((line) => (line ? RLM + line : line))
    .join('\n')
}

function selectRows(subtitles: Subtitle[], settings: ExportSettings): Subtitle[] {
  if (!settings.skipEmptyTranslations) return subtitles
  return subtitles.filter((s) => s.translation.trim() !== '')
}

function numberOf(sub: Subtitle, index: number, settings: ExportSettings): number {
  return settings.lineNumbering === 'recount' ? index + 1 : sub.id
}

function toSrt(subtitles: Subtitle[], settings: ExportSettings): string {
  return (
    selectRows(subtitles, settings)
      .map((sub, i) => {
        const text = applyRtl(pickText(sub, settings.content), settings.rtlOverride)
        return `${numberOf(sub, i, settings)}\n${sub.start} --> ${sub.end}\n${text}\n`
      })
      .join('\n') + '\n'
  )
}

function toVtt(subtitles: Subtitle[], settings: ExportSettings): string {
  const cues = selectRows(subtitles, settings)
    .map((sub, i) => {
      const text = applyRtl(pickText(sub, settings.content), settings.rtlOverride)
      const start = msToVttTimecode(sub.startMs)
      const end = msToVttTimecode(sub.endMs)
      return `${numberOf(sub, i, settings)}\n${start} --> ${end}\n${text}\n`
    })
    .join('\n')
  return `WEBVTT\n\n${cues}\n`
}

function toTxt(subtitles: Subtitle[], settings: ExportSettings): string {
  return (
    selectRows(subtitles, settings)
      .map((sub) => pickText(sub, settings.content))
      .join('\n') + '\n'
  )
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function toCsv(subtitles: Subtitle[], settings: ExportSettings): string {
  const header = ['id', 'start', 'end', 'original', 'translation']
  if (settings.includeNotes) header.push('notes')
  const rows = selectRows(subtitles, settings).map((sub) => {
    const cols = [String(sub.id), sub.start, sub.end, sub.original, sub.translation]
    if (settings.includeNotes) cols.push(sub.notes)
    return cols.map(csvEscape).join(',')
  })
  return [header.join(','), ...rows].join('\n') + '\n'
}

function toJson(subtitles: Subtitle[], settings: ExportSettings): string {
  const rows = selectRows(subtitles, settings).map((sub) => ({
    id: sub.id,
    start: sub.start,
    end: sub.end,
    startMs: sub.startMs,
    endMs: sub.endMs,
    original: sub.original,
    translation: sub.translation,
    status: sub.status,
    confidence: sub.confidence,
    cps: sub.cps,
    notes: sub.notes
  }))
  return JSON.stringify(rows, null, 2)
}

/** Serialise subtitles to the requested export format. Returns plain string (no BOM). */
export function writeSubtitles(subtitles: Subtitle[], settings: ExportSettings): string {
  switch (settings.format) {
    case 'vtt':
      return toVtt(subtitles, settings)
    case 'txt':
      return toTxt(subtitles, settings)
    case 'csv':
      return toCsv(subtitles, settings)
    case 'json':
      return toJson(subtitles, settings)
    case 'srt':
    default:
      return toSrt(subtitles, settings)
  }
}

/** Resolve an output filename from a template, e.g. "{name}_HEB". */
export function resolveOutputName(
  template: string,
  vars: { name: string; lang?: string }
): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '-')
  return template
    .replace(/\{name\}/g, vars.name)
    .replace(/\{lang\}/g, vars.lang ?? 'he')
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
}
