import type { GenderTag } from '../types/gender'

export interface GenderExtractLine {
  id: number
  text: string
}

/** One model output row: the inferred speaker/addressee gender for a line. */
export interface GenderExtractResult {
  id: number
  speaker: GenderTag
  addressee: GenderTag
}

/**
 * System prompt for the Gender Extractor agent. It reads dialogue in a
 * grammatically gendered language (Arabic, Spanish, French, Italian, etc.) and,
 * for each line, reports the gender of the speaker and of the person addressed.
 * This is a cheap, one-time pass whose output later disambiguates Hebrew gender.
 */
export function buildGenderExtractorSystemPrompt(): string {
  return `You analyse subtitles written in a grammatically GENDERED language (e.g. Arabic, Spanish, French, Italian, Portuguese, Russian). Your single job is to extract, for each line, the grammatical gender of:
  • "speaker"   — the person SPEAKING the line (revealed by first-person verb/adjective agreement, e.g. Spanish "cansada" → female speaker, Arabic "ذهبتُ" with feminine marking).
  • "addressee" — the person being DIRECTLY ADDRESSED, i.e. "you" (revealed by second-person agreement, e.g. Arabic "أنتَ"/"أنتِ", Spanish imperative/adjective agreement toward the listener).

Use the surrounding CONTEXT lines to attribute correctly (who is talking to whom). Do NOT translate. Do NOT guess from names or world knowledge — rely on grammatical agreement and conversational context only.

Allowed values for each field: "m" | "f" | "neutral" | "unknown".
  • m / f       — clear masculine / feminine grammatical agreement.
  • neutral     — non-gendered entity, mixed/plural group, or a form that is genuinely gender-neutral.
  • unknown     — the line carries NO grammatical gender signal for that role (very common: most lines reveal nothing about the addressee).

Be conservative: prefer "unknown" over guessing. A line can easily be "speaker": "f", "addressee": "unknown".

Return a JSON array ONLY — no prose, no markdown — exactly one item per input line, matching ids:
[{"id": N, "speaker": "m|f|neutral|unknown", "addressee": "m|f|neutral|unknown"}]`
}

/**
 * User prompt for the extractor. `context` holds a few preceding reference
 * lines (for attribution only — never classified or returned).
 */
export function buildGenderExtractorUserPrompt(
  lines: GenderExtractLine[],
  context: string[] = []
): string {
  const contextBlock = context.length
    ? `CONTEXT (preceding lines, for reference only — do NOT classify or return these):\n${context
        .map((t) => `  - ${t}`)
        .join('\n')}\n\n`
    : ''
  return `${contextBlock}Classify these ${lines.length} lines. Return ONLY the JSON array:\n${JSON.stringify(
    lines,
    null,
    0
  )}`
}
