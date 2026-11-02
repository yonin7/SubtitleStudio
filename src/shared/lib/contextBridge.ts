import type { Subtitle } from '../types/subtitle'
import type { Chunk, ContextBridge } from '../types/chunk'
import type { Glossary } from '../types/glossary'
import { CONTEXT_BRIDGE_SIZE, PREVIEW_BRIDGE_SIZE, SCENE_BREAK_GAP_MS } from '../constants'
import { subtitlesOfChunk } from './chunkManager'

/** Strip a leading "Name:" speaker label, if present. */
function speakerOf(line: string, glossary: Glossary | null): string | null {
  const match = line.match(/^\s*([A-Za-z][\w' .-]{1,30}):/)
  if (!match) return null
  const name = match[1].trim()
  if (!glossary) return name
  const known = Object.keys(glossary.characters).find(
    (k) => k.toLowerCase() === name.toLowerCase()
  )
  return known ?? name
}

/**
 * Build the continuity bridge for a chunk: tail of the previous chunk
 * (with translations), head of the next chunk (originals only), the last
 * identifiable speaker, and whether a scene break precedes this chunk.
 */
export function buildBridge(
  subtitles: Subtitle[],
  chunks: Chunk[],
  chunkIndex: number,
  glossary: Glossary | null = null,
  options: { contextSize?: number; previewSize?: number } = {}
): ContextBridge {
  const contextSize = options.contextSize ?? CONTEXT_BRIDGE_SIZE
  const previewSize = options.previewSize ?? PREVIEW_BRIDGE_SIZE

  const prevChunk = chunkIndex > 0 ? chunks[chunkIndex - 1] : null
  const nextChunk = chunkIndex < chunks.length - 1 ? chunks[chunkIndex + 1] : null
  const current = chunks[chunkIndex]

  const prevSubs = prevChunk ? subtitlesOfChunk(subtitles, prevChunk) : []
  const prevContext = prevSubs.slice(-contextSize).map((s) => ({
    id: s.id,
    original: s.original,
    translated: s.translation
  }))

  const nextPreview = nextChunk
    ? subtitlesOfChunk(subtitles, nextChunk)
        .slice(0, previewSize)
        .map((s) => ({ id: s.id, original: s.original }))
    : []

  const lastPrev = prevSubs[prevSubs.length - 1]
  const firstCurrent = current ? subtitles[current.startIndex] : undefined
  const sceneChanged =
    lastPrev != null && firstCurrent != null
      ? firstCurrent.startMs - lastPrev.endMs > SCENE_BREAK_GAP_MS
      : false

  // A speaker only "carries over" within the same scene. Across a scene cut the
  // speaker (and thus gender agreement) must NOT be assumed to continue.
  let activeSpeaker: string | null = null
  if (!sceneChanged) {
    for (let i = prevSubs.length - 1; i >= 0; i--) {
      const speaker = speakerOf(prevSubs[i].original, glossary)
      if (speaker) {
        activeSpeaker = speaker
        break
      }
    }
  }

  return { prevContext, nextPreview, activeSpeaker, sceneChanged }
}
