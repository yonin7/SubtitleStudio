import type { Subtitle } from '../types/subtitle'
import type { Chunk } from '../types/chunk'
import { SCENE_BREAK_GAP_MS } from '../constants'

export interface ChunkSplitOptions {
  chunkSize: number
  respectSceneBreaks: boolean
}

function newChunk(id: number, fileId: string, startIndex: number, endIndex: number): Chunk {
  return {
    id,
    fileId,
    startIndex,
    endIndex,
    status: 'pending',
    translatedCount: 0,
    totalCount: endIndex - startIndex + 1,
    retryCount: 0,
    confidence: null,
    error: null,
    completedAt: null
  }
}

/**
 * Split a file's subtitles into atomic chunks. Chunks reference subtitle index
 * ranges (no copies). Optionally breaks early on large inter-line gaps so
 * scene boundaries stay inside a single chunk.
 */
export function splitIntoChunks(
  subtitles: Subtitle[],
  fileId: string,
  options: ChunkSplitOptions
): Chunk[] {
  const { chunkSize, respectSceneBreaks } = options
  const chunks: Chunk[] = []
  if (subtitles.length === 0) return chunks

  let startIndex = 0
  for (let i = 0; i < subtitles.length; i++) {
    const isLast = i === subtitles.length - 1
    const isFull = i - startIndex + 1 >= chunkSize
    const next = subtitles[i + 1]
    const isSceneBreak =
      respectSceneBreaks && next != null && next.startMs - subtitles[i].endMs > SCENE_BREAK_GAP_MS

    if (isFull || isSceneBreak || isLast) {
      chunks.push(newChunk(chunks.length + 1, fileId, startIndex, i))
      startIndex = i + 1
    }
  }

  return chunks
}

/** Return the subtitles belonging to a chunk from the flat array. */
export function subtitlesOfChunk(subtitles: Subtitle[], chunk: Chunk): Subtitle[] {
  return subtitles.slice(chunk.startIndex, chunk.endIndex + 1)
}

/** Assign each subtitle its owning chunk id (returns a new array). */
export function assignChunkIds(subtitles: Subtitle[], chunks: Chunk[]): Subtitle[] {
  const result = subtitles.slice()
  for (const chunk of chunks) {
    for (let i = chunk.startIndex; i <= chunk.endIndex; i++) {
      result[i] = { ...result[i], chunkId: chunk.id }
    }
  }
  return result
}
