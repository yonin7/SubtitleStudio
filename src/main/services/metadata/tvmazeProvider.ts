import type { MetadataProvider } from './types'
import type { ContentDetection, MetadataCharacter, MetadataResult } from '@shared/types'

const TVMAZE_BASE = 'https://api.tvmaze.com'
const REQUEST_TIMEOUT_MS = 8000

interface TvmazeImage {
  medium?: string | null
  original?: string | null
}

interface TvmazeShow {
  id: number
  name: string
}

interface TvmazeSearchResult {
  score?: number
  show?: TvmazeShow | null
}

interface TvmazePerson {
  name?: string | null
  gender?: string | null
  image?: TvmazeImage | null
}

interface TvmazeCharacter {
  name?: string | null
  image?: TvmazeImage | null
}

interface TvmazeCastEntry {
  person?: TvmazePerson | null
  character?: TvmazeCharacter | null
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function mapEntry(entry: TvmazeCastEntry | null): MetadataCharacter | null {
  const characterName = entry?.character?.name
  if (!entry || !characterName) return null

  const rawGender = entry.person?.gender
  const gender = rawGender === 'Male' ? 'm' : rawGender === 'Female' ? 'f' : 'unknown'
  const confidence = gender === 'unknown' ? 'unknown' : 'verified'

  const character: MetadataCharacter = {
    name: characterName,
    gender,
    confidence,
    source: 'tvmaze'
  }

  if (entry.person?.name) character.actorName = entry.person.name

  const imageUrl = entry.character?.image?.medium ?? entry.person?.image?.medium
  if (imageUrl) character.imageUrl = imageUrl

  return character
}

export function createTvmazeProvider(): MetadataProvider {
  return {
    source: 'tvmaze',
    supports(contentType): boolean {
      return contentType === 'series' || contentType === 'other'
    },
    isAvailable(): boolean {
      return true
    },
    async search(detection: ContentDetection): Promise<MetadataResult | null> {
      const searchUrl = `${TVMAZE_BASE}/search/shows?q=${encodeURIComponent(detection.title)}`
      const searchResults = await fetchJson<TvmazeSearchResult[]>(searchUrl)

      const show = searchResults?.[0]?.show
      if (!show) return null

      const castUrl = `${TVMAZE_BASE}/shows/${show.id}/cast`
      const cast = await fetchJson<TvmazeCastEntry[]>(castUrl)
      if (!cast) return null

      const seen = new Set<string>()
      const characters: MetadataCharacter[] = []
      for (const entry of cast) {
        const mapped = mapEntry(entry)
        if (!mapped) continue
        if (seen.has(mapped.name)) continue
        seen.add(mapped.name)
        characters.push(mapped)
      }

      if (characters.length === 0) return null

      return {
        source: 'tvmaze',
        title: show.name,
        externalId: String(show.id),
        contentType: 'series',
        characters
      }
    }
  }
}
