import { describe, expect, it } from 'vitest'
import {
  timecodeToMs,
  msToTimecode,
  msToVttTimecode,
  shiftSubtitles,
  scaleSubtitles,
  fixOverlaps,
  fixShortDurations
} from './timecode'
import type { Subtitle } from '../types/subtitle'

function sub(id: number, startMs: number, endMs: number, translation = ''): Subtitle {
  return {
    id,
    fileId: 'f',
    chunkId: null,
    start: msToTimecode(startMs),
    end: msToTimecode(endMs),
    startMs,
    endMs,
    original: 'x',
    translation,
    status: 'empty',
    confidence: null,
    cps: 0,
    cpsWarning: false,
    notes: ''
  }
}

describe('timecode conversion', () => {
  it('parses SRT and VTT timecodes', () => {
    expect(timecodeToMs('01:23:45,678')).toBe(5025678)
    expect(timecodeToMs('01:23:45.678')).toBe(5025678)
    expect(timecodeToMs('00:00:00,000')).toBe(0)
  })

  it('round-trips ms -> timecode -> ms', () => {
    for (const ms of [0, 1, 999, 1000, 5025678, 36000000]) {
      expect(timecodeToMs(msToTimecode(ms))).toBe(ms)
    }
  })

  it('formats VTT timecodes with a dot', () => {
    expect(msToVttTimecode(5025678)).toBe('01:23:45.678')
  })
})

describe('timing fixes', () => {
  it('never produces negative timestamps on negative shift', () => {
    const result = shiftSubtitles([sub(1, 500, 1500)], -2000)
    expect(result[0].startMs).toBe(0)
    expect(result[0].endMs).toBe(0)
  })

  it('only shifts from the given index', () => {
    const result = shiftSubtitles([sub(1, 0, 1000), sub(2, 2000, 3000)], 500, 1)
    expect(result[0].startMs).toBe(0)
    expect(result[1].startMs).toBe(2500)
  })

  it('fixes overlaps without negative durations', () => {
    const result = fixOverlaps([sub(1, 0, 2000), sub(2, 1000, 3000)], 50)
    expect(result[0].endMs).toBe(950)
    expect(result[0].endMs).toBeGreaterThanOrEqual(result[0].startMs)
  })

  it('extends short durations to the minimum', () => {
    const result = fixShortDurations([sub(1, 0, 200)], 800)
    expect(result[0].endMs).toBe(800)
  })
})

describe('framerate scaling', () => {
  it('scales timings linearly from the origin', () => {
    const result = scaleSubtitles([sub(1, 1000, 2000)], 2)
    expect(result[0].startMs).toBe(2000)
    expect(result[0].endMs).toBe(4000)
  })

  it('keeps an anchor point fixed while scaling', () => {
    const result = scaleSubtitles([sub(1, 1000, 3000)], 2, 1000)
    expect(result[0].startMs).toBe(1000)
    expect(result[0].endMs).toBe(5000)
  })

  it('ignores invalid factors', () => {
    const input = [sub(1, 1000, 2000)]
    expect(scaleSubtitles(input, 0)).toBe(input)
    expect(scaleSubtitles(input, -1)).toBe(input)
  })
})
