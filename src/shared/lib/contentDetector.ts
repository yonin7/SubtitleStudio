import type { ContentDetection, ContentType } from '../types/metadata'

const ANIME_PATTERNS = [/\[[^\]]+\]/, /\b(720p|1080p).*?(sub|jpn|jp)\b/i, /\bjapanese\b/i]
const TV_PATTERNS = [/s\d{1,2}e\d{1,2}/i, /season[\s._]?\d+/i, /episode[\s._]?\d+/i]
const MOVIE_PATTERNS = [/\b(19|20)\d{2}\b/, /\b(bluray|bdrip|webrip|web-dl|hdtv|x264|x265)\b/i]

function detectContentType(name: string): ContentType {
  if (ANIME_PATTERNS.some((p) => p.test(name))) return 'anime'
  if (TV_PATTERNS.some((p) => p.test(name))) return 'series'
  if (MOVIE_PATTERNS.some((p) => p.test(name))) return 'movie'
  return 'other'
}

/**
 * Extract a clean title plus content hints from a (possibly messy) release
 * filename, used to route metadata lookups.
 */
export function detectContent(filename: string): ContentDetection {
  const base = filename.replace(/\.[a-z0-9]{2,4}$/i, '')
  const contentType = detectContentType(base)

  const yearMatch = base.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null

  const seMatch = base.match(/s(\d{1,2})e(\d{1,2})/i)
  const season = seMatch ? parseInt(seMatch[1], 10) : null
  const episode = seMatch ? parseInt(seMatch[2], 10) : null

  // Title = everything before the first strong release marker.
  let title = base
    .replace(/\[[^\]]*\]/g, ' ') // [SubGroup]
    .replace(/\([^)]*\)/g, ' ')
  const cutMarkers = [yearMatch?.[0], seMatch?.[0]].filter(Boolean) as string[]
  for (const marker of cutMarkers) {
    const idx = title.toLowerCase().indexOf(marker.toLowerCase())
    if (idx > 0) title = title.slice(0, idx)
  }
  title = title
    .replace(/[._]+/g, ' ')
    .replace(/\b(720p|1080p|2160p|4k|bluray|bdrip|webrip|web-dl|hdtv|x264|x265|h\.?264|h\.?265|aac|dts|hevc|sub|dub|multi|repack|proper|remux)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { contentType, title: title || base, year, season, episode }
}
