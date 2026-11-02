export interface ExtractedCharacter {
  name: string
  gender: 'm' | 'f' | 'neutral' | 'unknown'
}

export function buildGlossaryExtractorSystemPrompt(): string {
  return `You extract the recurring named characters from a subtitle sample, for a Hebrew translation glossary.

Return ONLY the proper-noun character names that speak or are addressed. Ignore generic roles unless they function as names. For each, guess the grammatical gender for Hebrew (m/f/neutral) from context, or "unknown" if unclear.

OUTPUT FORMAT (valid JSON array only):
[{"name": "Character Name", "gender": "m|f|neutral|unknown"}]`
}

export function buildGlossaryExtractorUserPrompt(sampleLines: string[]): string {
  return `Extract characters from this sample. Return JSON array only.\n${sampleLines.join('\n')}`
}
