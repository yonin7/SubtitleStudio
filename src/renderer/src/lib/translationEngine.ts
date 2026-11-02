import type { AIProviderId, Chunk, GenderCue, Glossary, StyleGuide, Subtitle } from '@shared/types'
import { alignGenderCues, buildBridge, parseJsonArray, subtitlesOfChunk } from '@shared/lib'
import { SCENE_BREAK_GAP_MS } from '@shared/constants'
import {
  buildTranslatorSystemPrompt,
  buildTranslatorUserPrompt,
  type GenderHint
} from '@shared/prompts'

interface TranslatedLine {
  id: number
  text: string
}

export interface TranslateChunkParams {
  subtitles: Subtitle[]
  chunks: Chunk[]
  chunkIndex: number
  sourceLang: string
  targetLang: string
  contentType: string
  styleGuide: StyleGuide | null
  glossary: Glossary | null
  provider: AIProviderId
  contextSize: number
  previewSize: number
  /** Optional per-line gender cues from a parallel gendered-language reference. */
  genderCues?: GenderCue[]
}

export class CountMismatchError extends Error {
  constructor(expected: number, received: number) {
    super(`AI returned ${received} lines, expected ${expected}`)
    this.name = 'CountMismatchError'
  }
}

/**
 * Translate a single chunk through the main-process AI bridge and return a
 * map of subtitle id -> translated text. Throws on count mismatch so the
 * caller can retry.
 */
export async function translateChunk(params: TranslateChunkParams): Promise<Map<number, string>> {
  const chunk = params.chunks[params.chunkIndex]
  const subs = subtitlesOfChunk(params.subtitles, chunk)
  const lines = subs.map((s) => ({ id: s.id, text: s.original }))

  // Subtitle ids that start a new scene inside this chunk (large timing gap),
  // so the model resets speaker/gender assumptions at those points.
  const sceneBreakIds: number[] = []
  for (let i = 1; i < subs.length; i++) {
    if (subs[i].startMs - subs[i - 1].endMs > SCENE_BREAK_GAP_MS) {
      sceneBreakIds.push(subs[i].id)
    }
  }

  // Map any time-aligned gender cues onto this chunk's lines.
  let genderHints: GenderHint[] = []
  if (params.genderCues && params.genderCues.length) {
    const aligned = alignGenderCues(subs, params.genderCues)
    genderHints = subs.flatMap((s) => {
      const cue = aligned.get(s.id)
      if (!cue) return []
      return [{ id: s.id, speaker: cue.speaker, addressee: cue.addressee } satisfies GenderHint]
    })
  }

  const bridge = buildBridge(params.subtitles, params.chunks, params.chunkIndex, params.glossary, {
    contextSize: params.contextSize,
    previewSize: params.previewSize
  })

  const system = buildTranslatorSystemPrompt({
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    chunkNum: params.chunkIndex + 1,
    totalChunks: params.chunks.length,
    contentType: params.contentType,
    styleGuide: params.styleGuide,
    glossary: params.glossary,
    bridge
  })
  const user = buildTranslatorUserPrompt(lines, sceneBreakIds, genderHints)

  const response = await window.electronAPI.callAI({
    system,
    user,
    temperature: 0.3,
    provider: params.provider
  })

  const parsed = parseJsonArray<TranslatedLine>(response.text)
  if (parsed.length !== lines.length) {
    throw new CountMismatchError(lines.length, parsed.length)
  }

  return new Map(parsed.map((item) => [item.id, String(item.text ?? '')]))
}
