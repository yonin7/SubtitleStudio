import type { AIProviderId, GenderCue, GenderTag, Subtitle } from '@shared/types'
import { parseJsonArray, splitIntoChunks, subtitlesOfChunk } from '@shared/lib'
import {
  buildGenderExtractorSystemPrompt,
  buildGenderExtractorUserPrompt,
  type GenderExtractResult
} from '@shared/prompts'

export interface ExtractGenderParams {
  /** Parsed subtitles of the reference (gendered-language) file. */
  subtitles: Subtitle[]
  fileId: string
  /** Lines per extraction window. */
  chunkSize?: number
  /** Preceding lines passed as attribution context per window. */
  contextSize?: number
  /** Cheap provider preferred for this bulk pass. */
  provider?: AIProviderId
  /** Delay between windows to ease rate limits. */
  delayMs?: number
  onProgress?: (done: number, total: number) => void
  /** Return true to stop early (e.g. the user removed the reference). */
  shouldStop?: () => boolean
}

const VALID: ReadonlySet<GenderTag> = new Set<GenderTag>(['m', 'f', 'neutral', 'unknown'])
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function normTag(value: unknown): GenderTag {
  return typeof value === 'string' && VALID.has(value as GenderTag) ? (value as GenderTag) : 'unknown'
}

/**
 * Run a one-time, cheap pass over a gendered-language reference file and return
 * a compact per-line gender map. Failures on individual windows are tolerated
 * (those lines simply stay unknown), so the pass never blocks on a bad chunk.
 */
export async function extractGenderCues(params: ExtractGenderParams): Promise<GenderCue[]> {
  const chunks = splitIntoChunks(params.subtitles, params.fileId, {
    chunkSize: params.chunkSize ?? 40,
    respectSceneBreaks: true
  })
  const system = buildGenderExtractorSystemPrompt()
  const byId = new Map(params.subtitles.map((s) => [s.id, s]))
  const contextSize = params.contextSize ?? 3
  const cues: GenderCue[] = []

  for (let i = 0; i < chunks.length; i++) {
    if (params.shouldStop?.()) break

    const chunk = chunks[i]
    const subs = subtitlesOfChunk(params.subtitles, chunk)
    const contextStart = Math.max(0, chunk.startIndex - contextSize)
    const context = params.subtitles.slice(contextStart, chunk.startIndex).map((s) => s.original)
    const lines = subs.map((s) => ({ id: s.id, text: s.original }))

    try {
      const response = await window.electronAPI.callAI({
        system,
        user: buildGenderExtractorUserPrompt(lines, context),
        temperature: 0,
        provider: params.provider ?? 'gemini-flash-lite'
      })
      const parsed = parseJsonArray<GenderExtractResult>(response.text)
      for (const item of parsed) {
        const sub = byId.get(item.id)
        if (!sub) continue
        cues.push({
          refId: sub.id,
          startMs: sub.startMs,
          endMs: sub.endMs,
          speaker: normTag(item.speaker),
          addressee: normTag(item.addressee),
          text: sub.original
        })
      }
    } catch {
      // Best-effort per window; unparsed lines stay unknown.
    }

    params.onProgress?.(i + 1, chunks.length)
    if (i < chunks.length - 1 && params.delayMs) await sleep(params.delayMs)
  }

  cues.sort((a, b) => a.startMs - b.startMs)
  return cues
}
