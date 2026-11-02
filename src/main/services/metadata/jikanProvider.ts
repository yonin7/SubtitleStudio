import type { MetadataProvider } from './types'
import type { ContentDetection, MetadataCharacter, MetadataResult } from '@shared/types'

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
const REQUEST_TIMEOUT_MS = 8000
const MAX_CHARACTERS = 25

interface JikanAnimeSummary {
  mal_id: number
  title?: string | null
}

interface JikanSearchResponse {
  data?: JikanAnimeSummary[] | null
}

interface JikanCharacterImages {
  jpg?: { image_url?: string | null } | null
}

interface JikanVoiceActor {
  person?: { name?: string | null } | null
  language?: string | null
}

interface JikanCharacterEntry {
  character?: {
    name?: string | null
    images?: JikanCharacterImages | null
    mal_id?: number | null
  } | null
  role?: string | null
  voice_actors?: JikanVoiceActor[] | null
}

interface JikanCharactersResponse {
  data?: JikanCharacterEntry[] | null
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

/** Convert Jikan's "Last, First" name formatting into "First Last". */
function normaliseName(name: string): string {
  const commaIndex = name.indexOf(',')
  if (commaIndex === -1) return name.trim()
  const last = name.slice(0, commaIndex).trim()
  const first = name.slice(commaIndex + 1).trim()
  if (!first) return last
  if (!last) return first
  return `${first} ${last}`
}

function mapEntry(entry: JikanCharacterEntry): MetadataCharacter | null {
  const rawName = entry.character?.name
  if (!rawName) return null

  const character: MetadataCharacter = {
    name: normaliseName(rawName),
    gender: 'unknown',
    confidence: 'unknown',
    source: 'jikan'
  }

  if (entry.role) character.role = entry.role

  const japaneseActor = entry.voice_actors?.find((v) => v?.language === 'Japanese')?.person?.name
  if (japaneseActor) character.actorName = japaneseActor

  const imageUrl = entry.character?.images?.jpg?.image_url
  if (imageUrl) character.imageUrl = imageUrl

  return character
}

export function createJikanProvider(): MetadataProvider {
  return {
    source: 'jikan',
    supports(contentType): boolean {
      return contentType === 'anime' || contentType === 'animation'
    },
    isAvailable(): boolean {
      return true
    },
    async search(detection: ContentDetection): Promise<MetadataResult | null> {
      const searchUrl = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(detection.title)}&limit=1`
      const searchResponse = await fetchJson<JikanSearchResponse>(searchUrl)

      const anime = searchResponse?.data?.[0]
      if (!anime) return null

      const malId = anime.mal_id
      const charactersUrl = `${JIKAN_BASE_URL}/anime/${malId}/characters`
      const charactersResponse = await fetchJson<JikanCharactersResponse>(charactersUrl)

      const entries = charactersResponse?.data ?? []
      const characters = entries
        .slice(0, MAX_CHARACTERS)
        .map(mapEntry)
        .filter((c): c is MetadataCharacter => c !== null)

      if (characters.length === 0) return null

      return {
        source: 'jikan',
        title: anime.title || detection.title,
        externalId: String(malId),
        contentType: 'anime',
        characters
      }
    }
  }
}
