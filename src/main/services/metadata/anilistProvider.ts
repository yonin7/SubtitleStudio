import type { MetadataProvider } from './types'
import type { ContentDetection, MetadataCharacter, MetadataResult } from '@shared/types'

const ANILIST_ENDPOINT = 'https://graphql.anilist.co'
const REQUEST_TIMEOUT_MS = 8000
const MAX_DESCRIPTION_LENGTH = 500

const CHARACTERS_QUERY = `query GetAnimeCharacters($search: String) {
  Media(search: $search, type: ANIME) {
    id
    title { romaji english native }
    characters(sort: [ROLE, RELEVANCE], perPage: 25) {
      edges {
        role
        node { id name { full native } gender description image { medium } }
      }
    }
  }
}`

interface AniListName {
  full?: string | null
  native?: string | null
}

interface AniListImage {
  medium?: string | null
}

interface AniListCharacterNode {
  id?: number | null
  name?: AniListName | null
  gender?: string | null
  description?: string | null
  image?: AniListImage | null
}

interface AniListCharacterEdge {
  role?: string | null
  node?: AniListCharacterNode | null
}

interface AniListMedia {
  id: number
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null
  characters?: { edges?: (AniListCharacterEdge | null)[] | null } | null
}

interface AniListResponse {
  data?: { Media?: AniListMedia | null } | null
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

function mapEdge(edge: AniListCharacterEdge | null): MetadataCharacter | null {
  const node = edge?.node
  const name = node?.name?.full
  if (!node || !name) return null

  const rawGender = node.gender
  const gender = rawGender === 'Male' ? 'm' : rawGender === 'Female' ? 'f' : 'unknown'
  const confidence = gender === 'unknown' ? 'unknown' : 'verified'

  const character: MetadataCharacter = {
    name,
    gender,
    confidence,
    source: 'anilist'
  }

  if (edge?.role) character.role = edge.role
  if (node.description) character.description = node.description.slice(0, MAX_DESCRIPTION_LENGTH)
  if (node.image?.medium) character.imageUrl = node.image.medium

  return character
}

export function createAniListProvider(): MetadataProvider {
  return {
    source: 'anilist',
    supports(contentType): boolean {
      return contentType === 'anime' || contentType === 'animation' || contentType === 'other'
    },
    isAvailable(): boolean {
      return true
    },
    async search(detection: ContentDetection): Promise<MetadataResult | null> {
      const body = JSON.stringify({
        query: CHARACTERS_QUERY,
        variables: { search: detection.title }
      })

      const response = await fetchJson<AniListResponse>(ANILIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })

      const media = response?.data?.Media
      if (!media) return null

      const edges = media.characters?.edges ?? []
      const characters = edges
        .map(mapEdge)
        .filter((c): c is MetadataCharacter => c !== null)

      if (characters.length === 0) return null

      return {
        source: 'anilist',
        title: media.title?.english || media.title?.romaji || detection.title,
        externalId: String(media.id),
        contentType: 'anime',
        characters
      }
    }
  }
}
