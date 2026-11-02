export interface GenderClassifyInput {
  name: string
  description?: string
}

export function buildGenderClassifierSystemPrompt(): string {
  return `You are a character gender classifier for Hebrew subtitle translation.
Given a character name and optional description, determine the grammatical gender needed for Hebrew conjugation. Respond with exactly one of: m / f / neutral.

Rules:
- Robots, AI, spirits, abstract entities → neutral
- Clear male pronouns/descriptions → m
- Clear female pronouns/descriptions → f
- Ambiguous → neutral (safer for Hebrew)

Return a JSON array ONLY, one item per input, matching names:
[{"name": "...", "gender": "m|f|neutral"}]`
}

export function buildGenderClassifierUserPrompt(characters: GenderClassifyInput[]): string {
  const payload = characters.map((c) => ({ name: c.name, description: c.description ?? '' }))
  return `Classify these characters. Return JSON array only.\n${JSON.stringify(payload)}`
}
