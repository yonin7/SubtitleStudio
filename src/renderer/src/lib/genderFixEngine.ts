import type { AIProviderId, Chunk, GenderCue, Subtitle } from '@shared/types'
import { alignGenderCues, cueHasSignal, parseJsonArray, subtitlesOfChunk } from '@shared/lib'
import {
  buildGenderFixerSystemPrompt,
  buildGenderFixerUserPrompt,
  type GenderFixLine
} from '@shared/prompts'

interface FixedLine {
  id: number
  text: string
}

export interface FixGenderChunkParams {
  subtitles: Subtitle[]
  chunks: Chunk[]
  chunkIndex: number
  genderCues: GenderCue[]
  provider?: AIProviderId
}

/**
 * Correct Hebrew gender conjugation on already-translated lines in one chunk.
 * Only lines with a non-unknown gender cue AND an existing translation are sent.
 */
export async function fixGenderChunk(params: FixGenderChunkParams): Promise<Map<number, string>> {
  const subs = subtitlesOfChunk(params.subtitles, params.chunks[params.chunkIndex])
  const aligned = alignGenderCues(subs, params.genderCues)

  const lines: GenderFixLine[] = []
  for (const sub of subs) {
    const cue = aligned.get(sub.id)
    if (!cue || !cueHasSignal(cue) || !sub.translation.trim()) continue
    lines.push({
      id: sub.id,
      original: sub.original,
      translation: sub.translation,
      speaker: cue.speaker,
      addressee: cue.addressee
    })
  }

  if (lines.length === 0) return new Map()

  const response = await window.electronAPI.callAI({
    system: buildGenderFixerSystemPrompt(),
    user: buildGenderFixerUserPrompt(lines),
    temperature: 0.1,
    provider: params.provider ?? 'gemini-flash-lite'
  })

  const parsed = parseJsonArray<FixedLine>(response.text)
  return new Map(parsed.map((item) => [item.id, String(item.text ?? '')]))
}
