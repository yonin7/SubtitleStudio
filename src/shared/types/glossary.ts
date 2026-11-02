import type { Confidence, ContentType, Gender, MetadataSource } from './metadata'

/** A glossary entry: a character with its confirmed Hebrew name and gender. */
export interface GlossaryCharacter {
  original: string
  hebrew: string
  gender: Gender
  confidence: Confidence
  source: MetadataSource
  role?: string
  actorName?: string
  description?: string
  imageUrl?: string
  /** True until the user resolves an unknown / flagged entry. */
  needsReview: boolean
}

/**
 * Shared translation memory for a project: confirmed character names/genders
 * plus fixed term translations. Injected into every translator prompt.
 */
export interface Glossary {
  source: MetadataSource
  title: string
  externalId: string | null
  /** Keyed by original character name. */
  characters: Record<string, GlossaryCharacter>
  /** Fixed term map, e.g. { "The Force": "הכוח" }. */
  terms: Record<string, string>
  userReviewed: boolean
}

/** Output of the Director agent — followed by every translator agent. */
export interface StyleGuide {
  contentType: ContentType | ''
  genre: string
  tone: string
  era: string
  formality: string
  dialoguePace: string
  addressingStyle: string
  dialect: string
  humorStyle: string
  specialObservations: string
  translationWarnings: string[]
}
