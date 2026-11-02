import type { ContentDetection, ContentType, MetadataResult, MetadataSource } from '@shared/types'
import {
  buildGenderClassifierSystemPrompt,
  buildGenderClassifierUserPrompt
} from '@shared/prompts'
import { parseJsonArray } from '@shared/lib'
import type { MetadataProvider } from './types'
import { callAI } from '../ai/apiManager'
import { createAniListProvider } from './anilistProvider'
import { createJikanProvider } from './jikanProvider'
import { createTvmazeProvider } from './tvmazeProvider'
import { createWikidataProvider } from './wikidataProvider'
import { createTmdbProvider } from './tmdbProvider'

const providers: Record<Exclude<MetadataSource, 'ai' | 'manual' | 'not_found'>, MetadataProvider> = {
  anilist: createAniListProvider(),
  jikan: createJikanProvider(),
  tvmaze: createTvmazeProvider(),
  wikidata: createWikidataProvider(),
  tmdb: createTmdbProvider()
}

type ProviderId = keyof typeof providers

/** Priority chains per content type (key-free sources still work without TMDB). */
const ROUTING: Record<ContentType, ProviderId[]> = {
  movie: ['tmdb', 'wikidata'],
  series: ['tmdb', 'tvmaze', 'wikidata'],
  anime: ['anilist', 'jikan', 'tmdb', 'wikidata'],
  animation: ['tmdb', 'anilist', 'wikidata'],
  documentary: ['tmdb', 'tvmaze', 'wikidata'],
  other: ['tmdb', 'anilist', 'tvmaze', 'wikidata']
}

function emptyResult(detection: ContentDetection): MetadataResult {
  return {
    source: 'not_found',
    title: detection.title,
    externalId: null,
    contentType: detection.contentType,
    characters: []
  }
}

interface GenderClassification {
  name: string
  gender: 'm' | 'f' | 'neutral'
}

/** Resolve still-unknown genders with a single batched AI classification call. */
async function inferUnknownGenders(result: MetadataResult): Promise<void> {
  const unknown = result.characters.filter((c) => c.gender === 'unknown')
  if (unknown.length === 0) return

  try {
    const response = await callAI({
      system: buildGenderClassifierSystemPrompt(),
      user: buildGenderClassifierUserPrompt(
        unknown.map((c) => ({ name: c.name, description: c.description }))
      ),
      temperature: 0
    })
    const classified = parseJsonArray<GenderClassification>(response.text)
    const byName = new Map(classified.map((c) => [c.name.toLowerCase(), c.gender]))

    for (const character of unknown) {
      const gender = byName.get(character.name.toLowerCase())
      if (gender === 'm' || gender === 'f' || gender === 'neutral') {
        character.gender = gender
        character.confidence = 'inferred'
      }
    }
  } catch {
    // AI inference is best-effort; unresolved characters stay 'unknown' for user review.
  }
}

/**
 * Look up character metadata for a title: route by content type, fall back
 * through the chain, then fill any missing genders via AI.
 */
export async function lookupCharacters(detection: ContentDetection): Promise<MetadataResult> {
  const order = ROUTING[detection.contentType] ?? ROUTING.other

  for (const id of order) {
    const provider = providers[id]
    if (!provider.isAvailable() || !provider.supports(detection.contentType)) continue
    try {
      const result = await provider.search(detection)
      if (result && result.characters.length > 0) {
        await inferUnknownGenders(result)
        return result
      }
    } catch {
      // Try the next provider in the chain.
    }
  }

  return emptyResult(detection)
}
