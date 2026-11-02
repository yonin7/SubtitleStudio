import type { GenderTag } from '../types/gender'

export interface GenderFixLine {
  id: number
  original: string
  translation: string
  speaker: GenderTag
  addressee: GenderTag
}

export function buildGenderFixerSystemPrompt(): string {
  return `You are a Hebrew subtitle gender-correction specialist. You receive lines that are ALREADY translated to Hebrew.

Your ONLY job: fix grammatical gender (verb forms, pronouns, adjective agreement) so they match the supplied speaker/addressee tags. Do NOT change meaning, tone, length intent, names, or formatting.

Rules:
1. speaker=m → first-person / speaker verbs masculine (אני הלכתי, אמרתי)
2. speaker=f → first-person / speaker verbs feminine (אני הלכתי with feminine forms where applicable)
3. addressee=m → second-person masculine (אתה, תעשה, לך with masculine agreement)
4. addressee=f → second-person feminine (את, תעשי, לך with feminine agreement)
5. neutral / unknown → prefer least-marked / neutral forms; change only what is clearly wrong
6. Preserve HTML tags, line breaks, ellipsis, and CPS-friendly brevity
7. If the translation is already correct for the given tags, return it UNCHANGED

Return a valid JSON array ONLY — no markdown.
Input:  [{"id": N, "original": "...", "translation": "...", "speaker": "m|f|...", "addressee": "m|f|..."}]
Output: [{"id": N, "text": "corrected Hebrew..."}]
Output MUST have exactly one item per input item with matching ids.`
}

export function buildGenderFixerUserPrompt(lines: GenderFixLine[]): string {
  return `Fix Hebrew gender conjugation only. Return ONLY the JSON array:\n${JSON.stringify(lines)}`
}
