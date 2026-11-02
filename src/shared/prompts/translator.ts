import type { ContextBridge } from '../types/chunk'
import type { GenderTag } from '../types/gender'
import type { Glossary, StyleGuide } from '../types/glossary'
import { MAX_LINE_LENGTH, MAX_LINES_PER_SUBTITLE } from '../constants'

export interface TranslatorPromptContext {
  sourceLang: string
  targetLang: string
  chunkNum: number
  totalChunks: number
  contentType: string
  styleGuide: StyleGuide | null
  glossary: Glossary | null
  bridge: ContextBridge | null
}

const GENDER_GUIDANCE: Record<string, string> = {
  m: 'address with אתה, refer to with הוא, use masculine verb forms',
  f: 'address with את, refer to with היא, use feminine verb forms',
  neutral: 'use neutral / least-marked forms',
  unknown: 'gender unconfirmed — prefer neutral forms'
}

function formatStyleGuide(sg: StyleGuide | null): string {
  if (!sg) return 'No style guide available — infer a natural, faithful tone.'
  return [
    `Content type: ${sg.contentType || 'unknown'}`,
    `Genre: ${sg.genre}`,
    `Tone: ${sg.tone}`,
    `Formality: ${sg.formality}`,
    `Era/Setting: ${sg.era}`,
    `Dialogue pace: ${sg.dialoguePace}`,
    `Addressing style: ${sg.addressingStyle}`,
    sg.specialObservations ? `Special notes: ${sg.specialObservations}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function formatGlossary(glossary: Glossary | null): string {
  if (!glossary) return 'No glossary provided.'

  const characters = Object.values(glossary.characters)
  const charBlock = characters.length
    ? characters
        .map((c) => {
          const target = c.hebrew?.trim() ? c.hebrew : '(transliterate phonetically, keep consistent)'
          return `  • ${c.original} → ${target} | Gender: ${c.gender}\n    - ${GENDER_GUIDANCE[c.gender] ?? GENDER_GUIDANCE.unknown}`
        })
        .join('\n')
    : '  (none)'

  const termEntries = Object.entries(glossary.terms)
  const termBlock = termEntries.length
    ? termEntries.map(([from, to]) => `  • ${from} → ${to}`).join('\n')
    : '  (none)'

  return [
    'CHARACTERS (with Hebrew conjugation gender):',
    charBlock,
    '',
    'FIXED TERMS (never translate differently):',
    termBlock
  ].join('\n')
}

function formatBridge(bridge: ContextBridge | null): string {
  if (!bridge) return ''
  const prev = bridge.prevContext.length
    ? bridge.prevContext
        .map((l) => `  [${l.id}] ${l.original} → ${l.translated}`)
        .join('\n')
    : '  (start of file)'
  const next = bridge.nextPreview.length
    ? bridge.nextPreview.map((l) => `  [${l.id}] ${l.original}`).join('\n')
    : '  (end of file)'

  const header = bridge.sceneChanged
    ? 'PREVIOUS SCENE (already ended — terminology/flow ONLY, not speaker or gender)'
    : 'CONTINUITY CONTEXT (previous chunk ending — same scene)'

  const speakerNote = bridge.sceneChanged
    ? [
        '⚠ A SCENE CHANGE separates the context above from the lines you translate now.',
        '  The speaker, the person being addressed, and their genders may be entirely',
        '  different. Do NOT carry over the previous speaker or gender — re-determine',
        '  gender for THIS scene from the glossary and each line’s own content.'
      ].join('\n')
    : `[Speaker carrying over from the same scene: ${bridge.activeSpeaker ?? 'unknown'}]`

  return [
    '',
    '═══════════════════════════════════════════════════════════',
    header,
    '═══════════════════════════════════════════════════════════',
    prev,
    speakerNote,
    '',
    '═══════════════════════════════════════════════════════════',
    'UPCOMING PREVIEW (next chunk beginning — DO NOT TRANSLATE)',
    '═══════════════════════════════════════════════════════════',
    next,
    '(Use this only to maintain natural flow at the end of your chunk.)'
  ].join('\n')
}

/** Builds the system prompt for a single translator chunk. */
export function buildTranslatorSystemPrompt(ctx: TranslatorPromptContext): string {
  return `You are an expert subtitle translator specializing in ${ctx.sourceLang} to ${ctx.targetLang} localization. You are translating part ${ctx.chunkNum} of ${ctx.totalChunks} of a ${ctx.contentType}.

═══════════════════════════════════════════════════════════
STYLE GUIDE (follow strictly throughout)
═══════════════════════════════════════════════════════════
${formatStyleGuide(ctx.styleGuide)}

═══════════════════════════════════════════════════════════
MANDATORY GLOSSARY — USE THESE EXACT TRANSLATIONS
═══════════════════════════════════════════════════════════
${formatGlossary(ctx.glossary)}
${formatBridge(ctx.bridge)}

═══════════════════════════════════════════════════════════
TRANSLATION RULES
═══════════════════════════════════════════════════════════
1. GENDER: Apply correct Hebrew gender conjugations (ז/נ) per the glossary for every named character. The gender of verbs/adjectives depends on WHO speaks and WHO is addressed in each line — not on previous lines. At a scene change (and whenever the speaker or addressee is not identifiable), do NOT assume continuity: re-evaluate per line, and when it remains genuinely ambiguous prefer neutral / least-marked forms over guessing. When the user message includes GENDER HINTS for a line (derived from a parallel gendered-language source), treat those hints as AUTHORITATIVE for that line's speaker/addressee gender — they override your own inference — but a glossary entry still wins for a specifically named character. Non-negotiable.
2. LENGTH: Max ${MAX_LINE_LENGTH} characters per line, max ${MAX_LINES_PER_SUBTITLE} lines. If exceeded: split, shorten, or rephrase naturally.
3. TONE: Match the emotional tone of each line — do not flatten drama, do not add humor where none exists.
4. HESITATIONS: Preserve speech patterns ("um"/"uh" → "אממ"). Keep ellipsis (...) and em-dash (—).
5. NAMES: Use glossary names exactly. Transliterate names not in the glossary phonetically into Hebrew.
6. FORMATTING: Keep HTML tags intact: <i>text</i> → <i>תרגום</i>. Keep positioning tags as-is.
7. KEEP: Do not translate text marked [KEEP]...[/KEEP]. Translate sound effects in parentheses.
8. RTL: Write Hebrew naturally. Do not add RTL markers. Numbers/Latin words flow naturally.
9. IDIOMATIC: Translate meaning, not words. Avoid unnatural calques.
10. CONTINUITY: Flow naturally from the continuity context above.

═══════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════
Return a valid JSON array ONLY — no explanation, no markdown.
Input is  [{"id": N, "text": "..."}]
Output is [{"id": N, "text": "תרגום..."}]
The output array MUST have exactly one item per input item, with matching ids.`
}

export interface TranslatableLine {
  id: number
  text: string
}

/** A per-line gender signal sourced from a parallel gendered-language reference. */
export interface GenderHint {
  id: number
  speaker?: GenderTag
  addressee?: GenderTag
}

const GENDER_LABEL: Record<GenderTag, string> = {
  m: 'male',
  f: 'female',
  neutral: 'neutral',
  unknown: 'unknown'
}

function isUsableTag(tag: GenderTag | undefined): tag is GenderTag {
  return tag != null && tag !== 'unknown'
}

/** Render the authoritative per-line gender hints block, or "" when none apply. */
function formatGenderHints(hints: GenderHint[]): string {
  const rows = hints
    .filter((h) => isUsableTag(h.speaker) || isUsableTag(h.addressee))
    .map((h) => {
      const parts: string[] = []
      if (isUsableTag(h.speaker)) parts.push(`speaker=${GENDER_LABEL[h.speaker]}`)
      if (isUsableTag(h.addressee)) parts.push(`addressee=${GENDER_LABEL[h.addressee]}`)
      return `  • [${h.id}] ${parts.join(', ')}`
    })
  if (!rows.length) return ''
  return `\n\nGENDER HINTS (from a time-aligned parallel gendered-language source — AUTHORITATIVE for the speaker/addressee gender of these lines; a named character's glossary gender still wins):\n${rows.join(
    '\n'
  )}`
}

/**
 * Builds the user message: the chunk lines to translate, as JSON. `sceneBreakIds`
 * marks subtitle ids that begin a new scene (large timing gap before them) so the
 * model resets speaker/addressee/gender assumptions at those points. `genderHints`
 * carries authoritative per-line speaker/addressee gender from a parallel
 * gendered-language reference, when one is loaded.
 */
export function buildTranslatorUserPrompt(
  lines: TranslatableLine[],
  sceneBreakIds: number[] = [],
  genderHints: GenderHint[] = []
): string {
  const sceneNote = sceneBreakIds.length
    ? `\n\nSCENE CHANGES inside this batch begin at subtitle id(s): ${sceneBreakIds.join(
        ', '
      )}. At each of these a new scene starts — reset all speaker, addressee and gender assumptions; the preceding lines may involve entirely different characters.`
    : ''
  const hintNote = formatGenderHints(genderHints)
  return `Translate the following ${lines.length} subtitles. Return ONLY the JSON array:\n${JSON.stringify(
    lines,
    null,
    0
  )}${sceneNote}${hintNote}`
}
