import type { MetadataProvider } from './types'
import type { ContentDetection, MetadataCharacter, MetadataResult } from '@shared/types'
import type { Gender } from '@shared/types'
import { firstKey } from '../ai/keyVault'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185'
const REQUEST_TIMEOUT_MS = 8000
const MAX_CAST = 25

interface TmdbMovieSearchItem {
  id: number
  title?: string | null
}

interface TmdbTvSearchItem {
  id: number
  name?: string | null
}

interface TmdbSearchResponse<T> {
  results?: T[] | null
}

interface TmdbMovieCastEntry {
  character?: string | null
  name?: string | null
  gender?: number | null
  profile_path?: string | null
  order?: number | null
}

interface TmdbTvCastRole {
  character?: string | null
}

interface TmdbTvCastEntry {
  roles?: TmdbTvCastRole[] | null
  name?: string | null
  gender?: number | null
  profile_path?: string | null
  order?: number | null
}

interface TmdbCreditsResponse<T> {
  cast?: T[] | null
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

function mapGender(raw: number | null | undefined): Gender {
  switch (raw) {
    case 1:
      return 'f'
    case 2:
      return 'm'
    case 3:
      return 'neutral'
    default:
      return 'unknown'
  }
}

function buildCharacter(
  characterName: string | null | undefined,
  actorName: string | null | undefined,
  rawGender: number | null | undefined,
  profilePath: string | null | undefined
): MetadataCharacter | null {
  if (!characterName) return null

  const gender = mapGender(rawGender)
  const confidence = gender === 'unknown' ? 'unknown' : 'inferred'

  const character: MetadataCharacter = {
    name: characterName,
    gender,
    confidence,
    source: 'tmdb'
  }

  if (actorName) character.actorName = actorName
  if (profilePath) character.imageUrl = `${TMDB_IMAGE_BASE}${profilePath}`

  return character
}

export function createTmdbProvider(): MetadataProvider {
  return {
    source: 'tmdb',
    supports(contentType): boolean {
      return contentType === 'movie' || contentType === 'series' || contentType === 'animation'
    },
    isAvailable(): boolean {
      return firstKey('tmdb').length > 0
    },
    async search(detection: ContentDetection): Promise<MetadataResult | null> {
      const key = firstKey('tmdb')
      if (!key) return null

      const isTv = detection.contentType === 'series'

      let id: number | null = null
      let resolvedTitle = detection.title

      if (isTv) {
        const url = `${TMDB_BASE}/search/tv?query=${encodeURIComponent(detection.title)}&api_key=${encodeURIComponent(key)}`
        const result = await fetchJson<TmdbSearchResponse<TmdbTvSearchItem>>(url)
        const first = result?.results?.[0]
        if (!first) return null
        id = first.id
        if (first.name) resolvedTitle = first.name
      } else {
        const yearParam = detection.year !== null ? `&year=${detection.year}` : ''
        const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(detection.title)}${yearParam}&api_key=${encodeURIComponent(key)}`
        const result = await fetchJson<TmdbSearchResponse<TmdbMovieSearchItem>>(url)
        const first = result?.results?.[0]
        if (!first) return null
        id = first.id
        if (first.title) resolvedTitle = first.title
      }

      const characters: MetadataCharacter[] = []

      if (isTv) {
        const url = `${TMDB_BASE}/tv/${id}/aggregate_credits?api_key=${encodeURIComponent(key)}`
        const credits = await fetchJson<TmdbCreditsResponse<TmdbTvCastEntry>>(url)
        const cast = credits?.cast
        if (!cast) return null

        const sorted = [...cast].sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
        for (const entry of sorted.slice(0, MAX_CAST)) {
          const mapped = buildCharacter(entry.roles?.[0]?.character, entry.name, entry.gender, entry.profile_path)
          if (mapped) characters.push(mapped)
        }
      } else {
        const url = `${TMDB_BASE}/movie/${id}/credits?api_key=${encodeURIComponent(key)}`
        const credits = await fetchJson<TmdbCreditsResponse<TmdbMovieCastEntry>>(url)
        const cast = credits?.cast
        if (!cast) return null

        const sorted = [...cast].sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
        for (const entry of sorted.slice(0, MAX_CAST)) {
          const mapped = buildCharacter(entry.character, entry.name, entry.gender, entry.profile_path)
          if (mapped) characters.push(mapped)
        }
      }

      if (characters.length === 0) return null

      return {
        source: 'tmdb',
        title: resolvedTitle,
        externalId: id !== null ? String(id) : null,
        contentType: detection.contentType,
        characters
      }
    }
  }
}
