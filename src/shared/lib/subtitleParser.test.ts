import { describe, expect, it } from 'vitest'
import { parseSubtitles, detectFormat } from './subtitleParser'

const SRT = `1\r\n00:00:01,000 --> 00:00:02,500\r\nHello world\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n<i>Italic</i> line\r\n`

const VTT = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nHello\n\nNOTE this is a note\n\n2\n00:00:03.000 --> 00:00:04.000\nWorld\n`

const ASS = `[Script Info]\nTitle: Test\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,{\\i1}Hello{\\i0}, world\n`

describe('detectFormat', () => {
  it('detects by extension and content', () => {
    expect(detectFormat('movie.srt')).toBe('srt')
    expect(detectFormat('movie.vtt')).toBe('vtt')
    expect(detectFormat('unknown', 'WEBVTT\n\n...')).toBe('vtt')
    expect(detectFormat('unknown', '[Script Info]\n')).toBe('ass')
  })
})

describe('parseSubtitles', () => {
  it('parses CRLF SRT and preserves HTML tags', () => {
    const subs = parseSubtitles(SRT, 'srt', 'f1')
    expect(subs).toHaveLength(2)
    expect(subs[0].original).toBe('Hello world')
    expect(subs[0].startMs).toBe(1000)
    expect(subs[1].original).toBe('<i>Italic</i> line')
  })

  it('handles a UTF-8 BOM', () => {
    const subs = parseSubtitles('\uFEFF' + SRT, 'srt', 'f1')
    expect(subs).toHaveLength(2)
    expect(subs[0].id).toBe(1)
  })

  it('parses VTT and skips NOTE blocks', () => {
    const subs = parseSubtitles(VTT, 'vtt', 'f1')
    expect(subs).toHaveLength(2)
    expect(subs[0].original).toBe('Hello')
    expect(subs[1].original).toBe('World')
  })

  it('parses ASS, stripping override tags', () => {
    const subs = parseSubtitles(ASS, 'ass', 'f1')
    expect(subs).toHaveLength(1)
    expect(subs[0].original).toBe('Hello, world')
    expect(subs[0].startMs).toBe(1000)
    expect(subs[0].endMs).toBe(2500)
  })
})
