import type { Glossary, StyleGuide, Subtitle } from '@shared/types'
import {
  buildDirectorSystemPrompt,
  buildDirectorUserPrompt,
  mapDirectorOutput,
  buildReviewerSystemPrompt,
  buildReviewerUserPrompt,
  type DirectorRawOutput,
  type ReviewResult
} from '@shared/prompts'
import { parseJsonObject } from '@shared/lib'

/**
 * Run the Director agent over the opening portion of the file (≤10%, capped
 * at 300 lines) to produce a project-wide style guide.
 */
export async function runDirectorAgent(subtitles: Subtitle[]): Promise<StyleGuide> {
  const sampleCount = Math.min(300, Math.max(20, Math.ceil(subtitles.length * 0.1)))
  const sample = subtitles.slice(0, sampleCount).map((s) => s.original)

  const response = await window.electronAPI.callAI({
    system: buildDirectorSystemPrompt(),
    user: buildDirectorUserPrompt(sample),
    temperature: 0.2,
    provider: 'gemini-flash'
  })

  return mapDirectorOutput(parseJsonObject<DirectorRawOutput>(response.text))
}

/** Run the Reviewer agent over a batch of translated subtitles for QA. */
export async function runReviewerAgent(
  lines: { id: number; original: string; translation: string }[],
  glossary: Glossary | null,
  styleGuide: StyleGuide | null
): Promise<ReviewResult> {
  const response = await window.electronAPI.callAI({
    system: buildReviewerSystemPrompt(glossary, styleGuide),
    user: buildReviewerUserPrompt(lines),
    temperature: 0
  })
  return parseJsonObject<ReviewResult>(response.text)
}

