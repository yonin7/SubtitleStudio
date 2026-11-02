import type { StyleGuide } from '../types/glossary'
import type { ContentType } from '../types/metadata'

/** Raw snake_case JSON the Director agent is asked to return. */
export interface DirectorRawOutput {
  content_type?: string
  genre?: string
  tone?: string
  era?: string
  formality?: string
  dialogue_pace?: string
  addressing_style?: string
  dialect?: string
  humor_style?: string
  special_observations?: string
  translation_warnings?: string[]
}

export function buildDirectorSystemPrompt(): string {
  return `You are a senior localization director analyzing a subtitle file to create a comprehensive style guide for a translation team.

Your output will be used by multiple translators working on separate sections of this content. Consistency and accuracy are critical.

Analyze the provided subtitle sample and return a JSON style guide. Do not translate. Only analyze and describe.

OUTPUT FORMAT (return valid JSON only, no other text):
{
  "content_type": "movie|series|anime|documentary|animation|other",
  "genre": "action|drama|comedy|horror|sci-fi|romance|thriller|animation|other",
  "tone": "serious|humorous|dramatic|neutral|dark|lighthearted",
  "era": "contemporary|historical|futuristic|fantasy|other",
  "formality": "very_informal|informal|balanced|formal|very_formal",
  "dialogue_pace": "fast|medium|slow",
  "addressing_style": "direct_you|formal_you|mixed",
  "dialect": "american_english|british_english|australian|other",
  "humor_style": "none|slapstick|witty|dark|sarcastic",
  "special_observations": "free text — recurring phrases, speech quirks, terminology domains, etc.",
  "translation_warnings": ["specific challenges the translators should watch out for"]
}`
}

export function buildDirectorUserPrompt(sampleLines: string[]): string {
  return `Analyze this subtitle sample (${sampleLines.length} lines) and return the JSON style guide:\n${sampleLines
    .map((l, i) => `${i + 1}. ${l}`)
    .join('\n')}`
}

/** Map the Director's snake_case output into the internal StyleGuide shape. */
export function mapDirectorOutput(raw: DirectorRawOutput): StyleGuide {
  const allowed: ContentType[] = ['movie', 'series', 'anime', 'animation', 'documentary', 'other']
  const contentType = allowed.includes(raw.content_type as ContentType)
    ? (raw.content_type as ContentType)
    : ''
  return {
    contentType,
    genre: raw.genre ?? '',
    tone: raw.tone ?? '',
    era: raw.era ?? '',
    formality: raw.formality ?? '',
    dialoguePace: raw.dialogue_pace ?? '',
    addressingStyle: raw.addressing_style ?? '',
    dialect: raw.dialect ?? '',
    humorStyle: raw.humor_style ?? '',
    specialObservations: raw.special_observations ?? '',
    translationWarnings: Array.isArray(raw.translation_warnings) ? raw.translation_warnings : []
  }
}
