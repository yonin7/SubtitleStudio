import type { MetadataProvider } from './types'
import type { ContentDetection, MetadataCharacter, MetadataResult } from '@shared/types'

const SEARCH_ENDPOINT = 'https://www.wikidata.org/w/api.php'
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const REQUEST_TIMEOUT_MS = 8000
const USER_AGENT = 'SubtitleStudio/2.1'

const WORK_DESCRIPTION_HINTS = ['film', 'movie', 'series', 'television', 'anime', 'franchise']
const BARE_QID = /^Q\d+$/i

interface SearchEntity {
  id?: string | null
  label?: string | null
  description?: string | null
}

interface SearchResponse {
  search?: (SearchEntity | null)[] | null
}

interface SparqlBindingValue {
  value?: string | null
}

interface SparqlBinding {
  characterLabel?: SparqlBindingValue | null
  genderLabel?: SparqlBindingValue | null
}

interface SparqlResponse {
  results?: { bindings?: (SparqlBinding | null)[] | null } | null
}

async function fetchJson<T>(url: string, extraHeaders?: Record<string, string>): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...extraHeaders },
      signal: controller.signal
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function pickWorkEntity(results: (SearchEntity | null)[]): SearchEntity | null {
  const valid = results.filter((r): r is SearchEntity => r !== null && typeof r.id === 'string')
  if (valid.length === 0) return null

  const matched = valid.find((r) => {
    const description = (r.description ?? '').toLowerCase()
    return WORK_DESCRIPTION_HINTS.some((hint) => description.includes(hint))
  })

  return matched ?? valid[0]
}

function mapGender(genderLabel: string | null | undefined): MetadataCharacter['gender'] {
  if (!genderLabel) return 'unknown'
  const label = genderLabel.toLowerCase()
  if (label.includes('female')) return 'f'
  if (label.includes('male')) return 'm'
  if (label.includes('non-binary') || label.includes('transgender')) return 'neutral'
  return 'neutral'
}

function mapBinding(binding: SparqlBinding | null): MetadataCharacter | null {
  const name = binding?.characterLabel?.value
  if (!name || BARE_QID.test(name)) return null

  const genderLabel = binding?.genderLabel?.value ?? null
  const gender = mapGender(genderLabel)
  const confidence = genderLabel ? 'verified' : 'unknown'

  return {
    name,
    gender,
    confidence,
    source: 'wikidata'
  }
}

function buildSparql(entityId: string): string {
  return `SELECT ?characterLabel ?genderLabel WHERE {
  wd:${entityId} wdt:P674 ?character .
  OPTIONAL { ?character wdt:P21 ?gender . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 50`
}

export function createWikidataProvider(): MetadataProvider {
  return {
    source: 'wikidata',
    supports(): boolean {
      return true
    },
    isAvailable(): boolean {
      return true
    },
    async search(detection: ContentDetection): Promise<MetadataResult | null> {
      const searchUrl = `${SEARCH_ENDPOINT}?action=wbsearchentities&search=${encodeURIComponent(detection.title)}&language=en&format=json&type=item&limit=5&origin=*`
      const searchResponse = await fetchJson<SearchResponse>(searchUrl)

      const results = searchResponse?.search ?? []
      const entity = pickWorkEntity(results)
      if (!entity || !entity.id) return null

      const entityId = entity.id
      const entityLabel = entity.label || detection.title

      const sparql = buildSparql(entityId)
      const sparqlUrl = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`
      const sparqlResponse = await fetchJson<SparqlResponse>(sparqlUrl, {
        Accept: 'application/sparql-results+json'
      })

      const bindings = sparqlResponse?.results?.bindings ?? []
      const characters = bindings
        .map(mapBinding)
        .filter((c): c is MetadataCharacter => c !== null)

      if (characters.length === 0) return null

      return {
        source: 'wikidata',
        title: entityLabel,
        externalId: entityId,
        contentType: detection.contentType,
        characters
      }
    }
  }
}
