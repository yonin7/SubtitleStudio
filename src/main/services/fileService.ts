import { readFile, writeFile } from 'node:fs/promises'
import chardet from 'chardet'
import iconv from 'iconv-lite'
import type { ReadFileResult } from '@shared/types'

/**
 * Read a subtitle file, auto-detecting its encoding and decoding to UTF-8.
 * Strips a leading BOM so downstream parsers see clean text.
 */
export async function readSubtitleFile(path: string): Promise<ReadFileResult> {
  const buffer = await readFile(path)
  const detected = (chardet.detect(buffer) ?? 'UTF-8').toUpperCase()

  let content: string
  if (detected.includes('UTF-8') || detected.includes('ASCII')) {
    content = buffer.toString('utf8')
  } else if (iconv.encodingExists(detected)) {
    content = iconv.decode(buffer, detected)
  } else {
    content = buffer.toString('utf8')
  }

  return { content: content.replace(/^\uFEFF/, ''), encoding: detected }
}

/** Write a UTF-8 text file, optionally prefixing a BOM (for Windows players). */
export async function writeTextFile(path: string, content: string, addBom = false): Promise<void> {
  const data = addBom ? '\uFEFF' + content : content
  await writeFile(path, Buffer.from(data, 'utf8'))
}
