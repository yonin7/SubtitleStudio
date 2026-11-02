import { describe, expect, it } from 'vitest'
import { splitIntoChunks, assignChunkIds, subtitlesOfChunk } from './chunkManager'
import { buildBridge } from './contextBridge'
import { msToTimecode } from './timecode'
import type { Subtitle } from '../types/subtitle'

function makeSubs(count: number, gapEveryN = 0): Subtitle[] {
  return Array.from({ length: count }, (_, i) => {
    const startMs = i * 2000 + (gapEveryN && i % gapEveryN === 0 && i > 0 ? 5000 * (i / gapEveryN) : 0)
    const endMs = startMs + 1000
    return {
      id: i + 1,
      fileId: 'f',
      chunkId: null,
      start: msToTimecode(startMs),
      end: msToTimecode(endMs),
      startMs,
      endMs,
      original: `line ${i + 1}`,
      translation: `שורה ${i + 1}`,
      status: 'ai_translated',
      confidence: null,
      cps: 0,
      cpsWarning: false,
      notes: ''
    }
  })
}

describe('splitIntoChunks', () => {
  it('splits into consistent sizes and loses no subtitles', () => {
    const subs = makeSubs(57)
    const chunks = splitIntoChunks(subs, 'f', { chunkSize: 25, respectSceneBreaks: false })
    expect(chunks).toHaveLength(3)
    expect(chunks[0].totalCount).toBe(25)
    expect(chunks[2].totalCount).toBe(7)
    const total = chunks.reduce((n, c) => n + c.totalCount, 0)
    expect(total).toBe(57)
  })

  it('returns an empty array for no subtitles', () => {
    expect(splitIntoChunks([], 'f', { chunkSize: 25, respectSceneBreaks: true })).toHaveLength(0)
  })

  it('assigns chunk ids covering every subtitle exactly once', () => {
    const subs = makeSubs(30)
    const chunks = splitIntoChunks(subs, 'f', { chunkSize: 10, respectSceneBreaks: false })
    const assigned = assignChunkIds(subs, chunks)
    expect(assigned.every((s) => s.chunkId !== null)).toBe(true)
    expect(subtitlesOfChunk(assigned, chunks[1]).map((s) => s.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  })
})

describe('buildBridge', () => {
  it('handles the first chunk with no previous context', () => {
    const subs = makeSubs(30)
    const chunks = splitIntoChunks(subs, 'f', { chunkSize: 10, respectSceneBreaks: false })
    const bridge = buildBridge(subs, chunks, 0)
    expect(bridge.prevContext).toHaveLength(0)
    expect(bridge.nextPreview.length).toBeGreaterThan(0)
  })

  it('provides translated tail of the previous chunk', () => {
    const subs = makeSubs(30)
    const chunks = splitIntoChunks(subs, 'f', { chunkSize: 10, respectSceneBreaks: false })
    const bridge = buildBridge(subs, chunks, 1)
    expect(bridge.prevContext).toHaveLength(5)
    expect(bridge.prevContext[4].translated).toBe('שורה 10')
  })
})
