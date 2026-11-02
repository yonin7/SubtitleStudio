import type { Glossary, StyleGuide } from '../types/glossary'

export type ReviewIssueType =
  | 'wrong_gender'
  | 'wrong_name'
  | 'too_long'
  | 'empty'
  | 'untranslated'
  | 'term_mismatch'

export interface ReviewIssue {
  subtitle_id: number
  type: ReviewIssueType
  description: string
  current_text: string
  suggested_fix: string
}

export interface ReviewResult {
  issues: ReviewIssue[]
  overall_quality_score: number
  summary: string
}

export function buildReviewerSystemPrompt(glossary: Glossary | null, styleGuide: StyleGuide | null): string {
  const glossaryJson = glossary
    ? JSON.stringify({
        characters: Object.values(glossary.characters).map((c) => ({
          original: c.original,
          hebrew: c.hebrew,
          gender: c.gender
        })),
        terms: glossary.terms
      })
    : '{}'

  return `You are a senior Hebrew localization quality reviewer reviewing translated subtitles for consistency and accuracy.

Identify ONLY genuine errors — do not flag stylistic preferences.

GLOSSARY:
${glossaryJson}

STYLE GUIDE SUMMARY:
Tone: ${styleGuide?.tone ?? 'n/a'}, Formality: ${styleGuide?.formality ?? 'n/a'}, Content type: ${styleGuide?.contentType ?? 'n/a'}

CHECK FOR:
1. Character names that don't match the glossary exactly
2. Incorrect gender conjugation for any glossary character
3. Lines exceeding 84 characters total (2 lines × 42)
4. Empty translations (original present, translation missing)
5. Untranslated words that should have been translated
6. Fixed glossary terms translated differently

DO NOT FLAG: stylistic word choices, minor punctuation, natural informal variation.

OUTPUT FORMAT (valid JSON only):
{
  "issues": [
    {
      "subtitle_id": 0,
      "type": "wrong_gender|wrong_name|too_long|empty|untranslated|term_mismatch",
      "description": "...",
      "current_text": "...",
      "suggested_fix": "..."
    }
  ],
  "overall_quality_score": 0,
  "summary": "..."
}`
}

export function buildReviewerUserPrompt(
  lines: { id: number; original: string; translation: string }[]
): string {
  return `Review these translated subtitles. Return JSON only.\n${JSON.stringify(lines)}`
}
