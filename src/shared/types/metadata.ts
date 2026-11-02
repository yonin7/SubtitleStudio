/** Grammatical gender used to drive Hebrew conjugation. */
export type Gender = 'm' | 'f' | 'neutral' | 'unknown'

/** How confident we are in a character's gender determination. */
export type Confidence = 'verified' | 'inferred' | 'unknown'

/** Where a piece of character/metadata came from. */
export type MetadataSource =
  | 'tmdb'
  | 'anilist'
  | 'jikan'
  | 'tvmaze'
  | 'wikidata'
  | 'ai'
  | 'manual'
  | 'not_found'

export type ContentType =
  | 'movie'
  | 'series'
  | 'anime'
  | 'animation'
  | 'documentary'
  | 'other'

/** A character as returned by a metadata provider, before user review. */
export interface MetadataCharacter {
  name: string
  gender: Gender
  confidence: Confidence
  source: MetadataSource
  role?: string
  /** Voice/on-screen actor, used as a gender hint and shown to the user. */
  actorName?: string
  /** Free-text bio, used for AI gender inference when gender is missing. */
  description?: string
  imageUrl?: string
}

/** Normalised result returned by any metadata provider. */
export interface MetadataResult {
  source: MetadataSource
  title: string
  externalId: string | null
  contentType: ContentType
  characters: MetadataCharacter[]
}

/** Parsed hints extracted from a filename to route metadata lookups. */
export interface ContentDetection {
  contentType: ContentType
  title: string
  year: number | null
  season: number | null
  episode: number | null
}
