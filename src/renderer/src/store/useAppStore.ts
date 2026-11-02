import { create, useStore } from 'zustand'
import { temporal } from 'zundo'
import type { TemporalState } from 'zundo'
import { v4 as uuid } from 'uuid'
import type {
  AIProviderState,
  ApiKeyInfo,
  AppSettings,
  Chunk,
  ContentDetection,
  ExportSettings,
  GenderReference,
  Glossary,
  GlossaryCharacter,
  KeyProviderId,
  MetadataCharacter,
  MetadataSource,
  SessionData,
  StyleGuide,
  Subtitle,
  SubtitleFile,
  WorkflowPlan
} from '@shared/types'
import { DEFAULT_WORKFLOW_PLAN } from '@shared/types/workflow'
import {
  emptyModuleStatusMap,
  type ModuleProgress,
  type ModuleRunState,
  type ModuleStatusMap,
  type ProcessingModuleId
} from '@shared/types/moduleStatus'
import type { ReviewIssue } from '@shared/prompts'
import {
  assignChunkIds,
  computeCps,
  detectContent,
  detectFormat,
  fixOverlaps,
  fixShortDurations,
  msToDuration,
  parseSubtitles,
  resolveOutputName,
  scaleSubtitles,
  shiftSubtitles,
  splitIntoChunks,
  applyReferenceTimings,
  writeSubtitles
} from '@shared/lib'
import { CHUNK_SIZE_BY_CONTENT } from '@shared/constants'
import { translateChunk } from '../lib/translationEngine'
import { extractGenderCues } from '../lib/genderExtractionEngine'
import { fixGenderChunk } from '../lib/genderFixEngine'
import { runDirectorAgent, runReviewerAgent } from '../lib/agents'

export type PanelId = 'editor' | 'chunkMap' | 'qa' | 'settings'
export type StatusTone = 'info' | 'success' | 'warning' | 'error'

export interface StatusMessage {
  text: string
  tone: StatusTone
}

/** Draft data for the mandatory Character Review screen. */
export interface CharacterReview {
  title: string
  source: MetadataSource
  characters: GlossaryCharacter[]
  terms: Record<string, string>
}

interface AppState {
  settings: AppSettings | null
  providerStatus: AIProviderState[]
  apiKeys: ApiKeyInfo[]

  file: SubtitleFile | null
  detection: ContentDetection | null
  subtitles: Subtitle[]
  chunks: Chunk[]
  glossary: Glossary | null
  styleGuide: StyleGuide | null
  genderRef: GenderReference | null
  review: CharacterReview | null
  qaIssues: ReviewIssue[]
  qaScore: number | null
  pendingResume: SessionData | null

  activePanel: PanelId
  status: StatusMessage | null
  isTranslating: boolean
  isPreparing: boolean
  isPaused: boolean
  isSyncOpen: boolean
  isExtractingGender: boolean
  isWorkflowOpen: boolean
  isWorkflowRunning: boolean
  workflowPlan: WorkflowPlan
  moduleStatus: ModuleStatusMap

  init: () => Promise<void>
  refreshProviderStatus: () => Promise<void>
  refreshApiKeys: () => Promise<void>
  addApiKey: (provider: KeyProviderId, key: string) => Promise<void>
  removeApiKey: (provider: KeyProviderId, index: number) => Promise<void>
  openFile: () => Promise<void>
  setActivePanel: (panel: PanelId) => void
  setStatus: (text: string, tone?: StatusTone) => void
  setModuleStatus: (
    module: ProcessingModuleId,
    state: ModuleRunState,
    detail?: string,
    progress?: ModuleProgress | null
  ) => void
  cancelGenderExtraction: () => void
  updateTranslation: (id: number, text: string) => void
  setSyncOpen: (open: boolean) => void
  setWorkflowOpen: (open: boolean) => void
  setWorkflowPlan: (plan: WorkflowPlan) => void
  runWorkflow: () => Promise<void>
  addGenderReference: () => Promise<void>
  removeGenderReference: () => void
  shiftAll: (offsetMs: number) => void
  scaleAll: (factor: number) => void
  fixTimings: (kind: 'overlaps' | 'short' | 'both') => void
  prepareTranslation: () => Promise<void>
  updateReviewCharacter: (original: string, patch: Partial<GlossaryCharacter>) => void
  addReviewCharacter: (name: string) => void
  removeReviewCharacter: (original: string) => void
  setReviewTerm: (from: string, to: string) => void
  removeReviewTerm: (from: string) => void
  confirmReview: () => void
  cancelReview: () => void
  applyQaFix: (issue: ReviewIssue) => void
  dismissQaIssue: (issue: ReviewIssue) => void
  applyResume: () => void
  discardResume: () => Promise<void>
  translateAll: () => Promise<void>
  translateFrom: (chunkId: number) => Promise<void>
  toggleSkipChunk: (chunkId: number) => void
  retranslateChunk: (chunkId: number) => Promise<void>
  pause: () => void
  resume: () => void
  exportSubtitles: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
  resetSettings: () => Promise<void>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Convert a metadata character into an editable glossary draft entry. */
function toGlossaryDraft(c: MetadataCharacter): GlossaryCharacter {
  return {
    original: c.name,
    hebrew: '',
    gender: c.gender,
    confidence: c.confidence,
    source: c.source,
    role: c.role,
    actorName: c.actorName,
    description: c.description,
    imageUrl: c.imageUrl,
    needsReview: c.gender === 'unknown'
  }
}

/** Recompute CPS/CPS-warning for every subtitle (after a timing change). */
function withCps(subtitles: Subtitle[]): Subtitle[] {
  return subtitles.map((sub) => ({ ...sub, ...computeCps(sub) }))
}

/** Apply gender-fix results onto existing translations (preserves non-fixed lines). */
function applyGenderFixes(subtitles: Subtitle[], map: Map<number, string>): Subtitle[] {
  return subtitles.map((sub) => {
    if (!map.has(sub.id)) return sub
    const translation = map.get(sub.id) ?? ''
    const next: Subtitle = {
      ...sub,
      translation,
      status: sub.status === 'empty' ? 'ai_translated' : 'reviewed'
    }
    const { cps, cpsWarning } = computeCps(next)
    return { ...next, cps, cpsWarning }
  })
}

/** Apply a translation map to the subtitle list, recomputing CPS + status. */
function applyTranslations(subtitles: Subtitle[], map: Map<number, string>): Subtitle[] {
  return subtitles.map((sub) => {
    if (!map.has(sub.id)) return sub
    const translation = map.get(sub.id) ?? ''
    const next: Subtitle = { ...sub, translation, status: 'ai_translated' }
    const { cps, cpsWarning } = computeCps(next)
    return { ...next, cps, cpsWarning }
  })
}

export const useAppStore = create<AppState>()(
  temporal(
    (set, get) => ({
  settings: null,
  providerStatus: [],
  apiKeys: [],
  file: null,
  detection: null,
  subtitles: [],
  chunks: [],
  glossary: null,
  styleGuide: null,
  genderRef: null,
  review: null,
  qaIssues: [],
  qaScore: null,
  pendingResume: null,
  activePanel: 'editor',
  status: null,
  isTranslating: false,
  isPreparing: false,
  isPaused: false,
  isSyncOpen: false,
  isExtractingGender: false,
  isWorkflowOpen: false,
  isWorkflowRunning: false,
  workflowPlan: DEFAULT_WORKFLOW_PLAN,
  moduleStatus: emptyModuleStatusMap(),

  async init() {
    const settings = await window.electronAPI.getSettings()
    set({ settings })
    window.electronAPI.onAiNotice((notice) => {
      get().setStatus(notice.message, 'warning')
      void get().refreshProviderStatus()
    })
    await get().refreshProviderStatus()
    await get().refreshApiKeys()
  },

  async refreshProviderStatus() {
    set({ providerStatus: await window.electronAPI.getProviderStatus() })
  },

  async refreshApiKeys() {
    set({ apiKeys: await window.electronAPI.getApiKeys() })
  },

  async addApiKey(provider, key) {
    set({ apiKeys: await window.electronAPI.addApiKey(provider, key) })
    await get().refreshProviderStatus()
  },

  async removeApiKey(provider, index) {
    set({ apiKeys: await window.electronAPI.removeApiKey(provider, index) })
    await get().refreshProviderStatus()
  },

  setActivePanel(panel) {
    set({ activePanel: panel })
  },

  setStatus(text, tone = 'info') {
    set({ status: { text, tone } })
  },

  setModuleStatus(module, state, detail = '', progress = null) {
    set((s) => ({
      moduleStatus: {
        ...s.moduleStatus,
        [module]: { state, detail, progress }
      }
    }))
  },

  cancelGenderExtraction() {
    if (!get().isExtractingGender) return
    set({ isExtractingGender: false, genderRef: null })
    get().setModuleStatus('gender', 'idle')
    get().setStatus('Gender reference scan cancelled.', 'warning')
  },

  async openFile() {
    const { canceled, path } = await window.electronAPI.openFileDialog()
    if (canceled || !path) return

    const { content } = await window.electronAPI.readSubtitleFile(path)
    const filename = path.split(/[\\/]/).pop() ?? 'subtitles.srt'
    const format = detectFormat(filename, content)
    const fileId = uuid()
    const parsed = parseSubtitles(content, format, fileId)

    if (parsed.length === 0) {
      get().setStatus('No subtitles found — unsupported or empty file.', 'error')
      return
    }

    const detection = detectContent(filename)
    const settings = get().settings
    const chunkSize =
      settings?.chunks.defaultChunkSize ?? CHUNK_SIZE_BY_CONTENT[detection.contentType]
    const chunks = splitIntoChunks(parsed, fileId, {
      chunkSize,
      respectSceneBreaks: settings?.chunks.respectSceneBreaks ?? true
    })
    const subtitles = assignChunkIds(parsed, chunks)
    const lastEnd = subtitles[subtitles.length - 1]?.endMs ?? 0

    const file: SubtitleFile = {
      id: fileId,
      filename,
      originalPath: path,
      language: settings?.translation.defaultSourceLang ?? 'auto',
      format,
      encoding: 'utf-8',
      totalSubtitles: subtitles.length,
      totalChunks: chunks.length,
      duration: msToDuration(lastEnd)
    }

    set({
      file,
      detection,
      subtitles,
      chunks,
      glossary: null,
      styleGuide: null,
      genderRef: null,
      review: null,
      qaIssues: [],
      qaScore: null,
      pendingResume: null,
      isExtractingGender: false,
      activePanel: 'editor',
      moduleStatus: emptyModuleStatusMap()
    })
    useAppStore.temporal.getState().clear()
    get().setStatus(
      `Loaded ${subtitles.length} subtitles in ${chunks.length} chunks (${detection.contentType}).`,
      'success'
    )

    const session = await window.electronAPI.loadSession(path)
    if (session && session.totalSubtitles === subtitles.length) {
      // The gender reference is expensive to rebuild, so restore it immediately
      // (independent of the resume decision for translations).
      if (session.genderReference) {
        const ref = {
          ...session.genderReference,
          timings: session.genderReference.timings ?? []
        }
        set({ genderRef: ref })
        const usable = ref.cues.filter(
          (c) => c.speaker !== 'unknown' || c.addressee !== 'unknown'
        ).length
        get().setModuleStatus('gender', 'done', `${usable} cues ready`)
      }
      set({ pendingResume: session })
    }
  },

  updateTranslation(id, text) {
    set((state) => ({
      subtitles: state.subtitles.map((sub) => {
        if (sub.id !== id) return sub
        const next: Subtitle = { ...sub, translation: text, status: 'manual' }
        const { cps, cpsWarning } = computeCps(next)
        return { ...next, cps, cpsWarning }
      })
    }))
  },

  setSyncOpen(open) {
    set({ isSyncOpen: open })
  },

  setWorkflowOpen(open) {
    set({ isWorkflowOpen: open })
  },

  setWorkflowPlan(plan) {
    set({ workflowPlan: plan })
  },

  async runWorkflow() {
    const plan = get().workflowPlan
    if (!plan.modules.length || get().isWorkflowRunning || get().isTranslating) return

    const needsRefSync =
      plan.modules.includes('sync') && plan.timingSource === 'reference'
    const needsGender = plan.modules.includes('gender')
    const ref = get().genderRef

    if (needsRefSync && !ref?.timings?.length) {
      get().setStatus('Sync needs a gender-reference file with timings.', 'error')
      return
    }
    if (needsGender && !ref?.cues.length) {
      get().setStatus('Gender fix needs extracted cues — load a gender reference first.', 'error')
      return
    }
    if (needsGender && !get().subtitles.some((s) => s.translation.trim() !== '')) {
      get().setStatus('Gender fix needs existing Hebrew translations.', 'error')
      return
    }

    set({ isWorkflowRunning: true, isWorkflowOpen: false })

    try {
      if (plan.modules.includes('sync') && plan.timingSource === 'reference' && ref) {
        get().setModuleStatus('sync', 'running', 'adopting reference timings')
        const { subtitles, matched } = applyReferenceTimings(get().subtitles, ref.timings)
        set({ subtitles: withCps(subtitles) })
        get().setModuleStatus('sync', 'done', `${matched}/${subtitles.length} matched`)
        get().setStatus(
          `Sync: adopted reference timings for ${matched}/${subtitles.length} lines.`,
          'success'
        )
        void persistSession(get)
      }

      if (plan.modules.includes('translate')) {
        await runTranslation(set, get, 0)
      } else {
        get().setModuleStatus('translate', 'idle')
      }

      if (plan.modules.includes('gender') && ref) {
        await runGenderFixAll(set, get, ref.cues)
      } else if (!get().isExtractingGender) {
        get().setModuleStatus('gender', 'idle')
      }

      if (!get().isPaused) get().setStatus('Workflow finished.', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      get().setStatus(`Workflow failed: ${message}`, 'error')
    } finally {
      set({ isWorkflowRunning: false })
      void persistSession(get)
    }
  },

  async addGenderReference() {
    if (get().isExtractingGender || get().isTranslating || !get().subtitles.length) return

    const { canceled, path } = await window.electronAPI.openFileDialog()
    if (canceled || !path) return

    const { content } = await window.electronAPI.readSubtitleFile(path)
    const filename = path.split(/[\\/]/).pop() ?? 'reference.srt'
    const format = detectFormat(filename, content)
    const refId = uuid()
    const refSubs = parseSubtitles(content, format, refId)

    if (refSubs.length === 0) {
      get().setStatus('No subtitles found in the reference file.', 'error')
      return
    }

    const timings = refSubs.map((s) => ({ startMs: s.startMs, endMs: s.endMs }))

    set({
      isExtractingGender: true,
      genderRef: {
        filename,
        language: 'auto',
        totalLines: refSubs.length,
        cues: [],
        timings
      }
    })
    get().setModuleStatus('gender', 'running', 'scanning reference', { current: 0, total: refSubs.length })
    get().setStatus(`Reading gender reference “${filename}” (${refSubs.length} lines)…`, 'info')

    try {
      const cues = await extractGenderCues({
        subtitles: refSubs,
        fileId: refId,
        chunkSize: get().settings?.chunks.defaultChunkSize ?? 40,
        delayMs: get().settings?.api.batchDelay ?? 1500,
        onProgress: (done, total) => {
          get().setModuleStatus('gender', 'running', `analysing ${done}/${total}`, { current: done, total })
          get().setStatus(`Gender reference: analysing window ${done}/${total}…`, 'info')
        },
        shouldStop: () => !get().isExtractingGender
      })

      // Abort the commit if the reference was removed/replaced mid-extraction.
      if (!get().isExtractingGender || get().genderRef?.filename !== filename) return

      const usable = cues.filter((c) => c.speaker !== 'unknown' || c.addressee !== 'unknown').length
      set({
        genderRef: { filename, language: 'auto', totalLines: refSubs.length, cues, timings },
        isExtractingGender: false
      })
      get().setModuleStatus('gender', 'done', `${usable} cues ready`)
      get().setStatus(
        `Gender reference ready: ${usable} gendered cue(s) from ${refSubs.length} lines.`,
        'success'
      )
      void persistSession(get)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ isExtractingGender: false, genderRef: null })
      get().setModuleStatus('gender', 'error', 'scan failed')
      get().setStatus(`Gender extraction failed: ${message}`, 'error')
    }
  },

  removeGenderReference() {
    if (get().isTranslating) return
    set({ genderRef: null, isExtractingGender: false })
    get().setModuleStatus('gender', 'idle')
    get().setStatus('Gender reference removed.', 'info')
    void persistSession(get)
  },

  shiftAll(offsetMs) {
    if (!offsetMs || !get().subtitles.length) return
    get().setModuleStatus('sync', 'running', 'shifting timings')
    set({ subtitles: withCps(shiftSubtitles(get().subtitles, offsetMs)) })
    get().setModuleStatus('sync', 'done', `shift ${offsetMs > 0 ? '+' : ''}${offsetMs}ms`)
    get().setStatus(`Shifted all subtitles by ${offsetMs > 0 ? '+' : ''}${offsetMs} ms.`, 'success')
  },

  scaleAll(factor) {
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1 || !get().subtitles.length) return
    get().setModuleStatus('sync', 'running', 'scaling timings')
    set({ subtitles: withCps(scaleSubtitles(get().subtitles, factor)) })
    get().setModuleStatus('sync', 'done', `×${factor.toFixed(4)}`)
    get().setStatus(`Scaled timings by ×${factor.toFixed(5)}.`, 'success')
  },

  fixTimings(kind) {
    if (!get().subtitles.length) return
    get().setModuleStatus('sync', 'running', 'fixing timings')
    let next = get().subtitles
    if (kind === 'short' || kind === 'both') next = fixShortDurations(next)
    if (kind === 'overlaps' || kind === 'both') next = fixOverlaps(next)
    set({ subtitles: withCps(next) })
    get().setModuleStatus('sync', 'done', kind)
    get().setStatus('Timing issues fixed.', 'success')
  },

  async prepareTranslation() {
    const { subtitles, detection, settings } = get()
    if (!subtitles.length || !detection || !settings || get().isPreparing) return

    set({ isPreparing: true })
    get().setModuleStatus('translate', 'running', 'preparing')
    try {
      if (settings.translation.runDirectorAgent && !get().styleGuide) {
        get().setStatus('Director agent analysing style…', 'info')
        try {
          set({ styleGuide: await runDirectorAgent(subtitles) })
        } catch {
          get().setStatus('Director agent skipped (will translate without a style guide).', 'warning')
        }
      }

      let characters: GlossaryCharacter[] = []
      let title = detection.title
      let source: MetadataSource = 'not_found'

      if (settings.character.autoLookup) {
        get().setStatus('Looking up characters…', 'info')
        const result = await window.electronAPI.lookupCharacters(detection)
        title = result.title
        source = result.source
        characters = result.characters.map(toGlossaryDraft)
      }

      set({ review: { title, source, characters, terms: {} } })
      get().setStatus(
        characters.length
          ? `Found ${characters.length} characters from ${source}. Confirm genders to continue.`
          : 'No characters found — add any key characters manually, then confirm.',
        characters.length ? 'success' : 'warning'
      )
    } finally {
      set({ isPreparing: false })
      if (!get().isTranslating) get().setModuleStatus('translate', 'idle')
    }
  },

  updateReviewCharacter(original, patch) {
    set((state) => {
      if (!state.review) return {}
      return {
        review: {
          ...state.review,
          characters: state.review.characters.map((c) => {
            if (c.original !== original) return c
            const next = { ...c, ...patch }
            next.needsReview = next.gender === 'unknown'
            return next
          })
        }
      }
    })
  },

  addReviewCharacter(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    set((state) => {
      if (!state.review || state.review.characters.some((c) => c.original === trimmed)) return {}
      const entry: GlossaryCharacter = {
        original: trimmed,
        hebrew: '',
        gender: 'unknown',
        confidence: 'unknown',
        source: 'manual',
        needsReview: true
      }
      return { review: { ...state.review, characters: [...state.review.characters, entry] } }
    })
  },

  removeReviewCharacter(original) {
    set((state) => {
      if (!state.review) return {}
      return {
        review: {
          ...state.review,
          characters: state.review.characters.filter((c) => c.original !== original)
        }
      }
    })
  },

  setReviewTerm(from, to) {
    const key = from.trim()
    if (!key) return
    set((state) => {
      if (!state.review) return {}
      return { review: { ...state.review, terms: { ...state.review.terms, [key]: to } } }
    })
  },

  removeReviewTerm(from) {
    set((state) => {
      if (!state.review) return {}
      const terms = { ...state.review.terms }
      delete terms[from]
      return { review: { ...state.review, terms } }
    })
  },

  confirmReview() {
    const review = get().review
    if (!review) return
    const characters: Record<string, GlossaryCharacter> = {}
    for (const c of review.characters) {
      characters[c.original] = { ...c, needsReview: false }
    }
    const glossary: Glossary = {
      source: review.source,
      title: review.title,
      externalId: null,
      characters,
      terms: review.terms,
      userReviewed: true
    }
    set({ glossary, review: null })
    void persistSession(get)
    get().setStatus('Glossary confirmed. Ready to translate.', 'success')
  },

  cancelReview() {
    set({ review: null })
  },

  applyQaFix(issue) {
    if (issue.suggested_fix) get().updateTranslation(issue.subtitle_id, issue.suggested_fix)
    get().dismissQaIssue(issue)
  },

  dismissQaIssue(issue) {
    set((state) => ({
      qaIssues: state.qaIssues.filter(
        (i) => !(i.subtitle_id === issue.subtitle_id && i.type === issue.type)
      )
    }))
  },

  applyResume() {
    const session = get().pendingResume
    if (!session) return

    const translationById = new Map(session.subtitles.map((s) => [s.id, s]))
    const subtitles = get().subtitles.map((sub) => {
      const saved = translationById.get(sub.id)
      if (!saved) return sub
      const next: Subtitle = {
        ...sub,
        translation: saved.translation,
        status: saved.status,
        confidence: saved.confidence
      }
      const { cps, cpsWarning } = computeCps(next)
      return { ...next, cps, cpsWarning }
    })

    const statusById = new Map(session.chunks.map((c) => [c.id, c]))
    const chunks = get().chunks.map((chunk) => {
      const saved = statusById.get(chunk.id)
      if (!saved) return chunk
      const translated = subtitles
        .slice(chunk.startIndex, chunk.endIndex + 1)
        .filter((s) => s.status === 'ai_translated' || s.status === 'manual' || s.status === 'reviewed').length
      return {
        ...chunk,
        status: saved.status,
        completedAt: saved.completedAt,
        error: saved.error,
        translatedCount: translated
      }
    })

    set({
      subtitles,
      chunks,
      glossary: session.glossary,
      styleGuide: session.styleGuide,
      pendingResume: null
    })
    const done = chunks.filter((c) => c.status === 'completed').length
    get().setStatus(`Resumed: ${done}/${chunks.length} chunks already translated.`, 'success')
  },

  async discardResume() {
    const file = get().file
    set({ pendingResume: null })
    if (file) await window.electronAPI.clearSession(file.originalPath)
  },

  async translateAll() {
    if (get().isTranslating || !get().settings) return
    await runTranslation(set, get, 0)
  },

  async translateFrom(chunkId) {
    if (get().isTranslating || !get().settings) return
    const index = get().chunks.findIndex((c) => c.id === chunkId)
    if (index === -1) return
    await runTranslation(set, get, index)
  },

  toggleSkipChunk(chunkId) {
    if (get().isTranslating) return
    set({
      chunks: get().chunks.map((c) => {
        if (c.id !== chunkId) return c
        if (c.status === 'skipped') return { ...c, status: 'pending', error: null }
        if (c.status === 'pending' || c.status === 'failed') return { ...c, status: 'skipped' }
        return c
      })
    })
  },

  async retranslateChunk(chunkId) {
    const index = get().chunks.findIndex((c) => c.id === chunkId)
    if (index === -1 || get().isTranslating) return
    set({ isTranslating: true, isPaused: false })
    useAppStore.temporal.getState().pause()
    await runChunk(set, get, index)
    set({ isTranslating: false })
    useAppStore.temporal.getState().resume()
    await get().refreshProviderStatus()
  },

  pause() {
    set({ isPaused: true })
    get().setStatus('Pausing after the current chunk…', 'warning')
  },

  resume() {
    void get().translateAll()
  },

  async exportSubtitles() {
    const { file, subtitles, settings } = get()
    if (!file || !settings) return

    const exportSettings: ExportSettings = {
      format: settings.export.defaultFormat,
      content: settings.export.defaultContent,
      encoding: settings.export.addBom ? 'utf-8-bom' : 'utf-8',
      rtlOverride: settings.export.rtlOverride,
      lineNumbering: 'original',
      includeNotes: false,
      outputTemplate: settings.export.outputTemplate,
      skipEmptyTranslations: false
    }

    const baseName = file.filename.replace(/\.[^.]+$/, '')
    const outName = resolveOutputName(exportSettings.outputTemplate, { name: baseName })
    const defaultName = `${outName}.${exportSettings.format}`

    const { canceled, path } = await window.electronAPI.saveFileDialog(defaultName)
    if (canceled || !path) return

    const output = writeSubtitles(subtitles, exportSettings)
    await window.electronAPI.writeFile(path, output, settings.export.addBom)
    get().setStatus(`Exported to ${path}`, 'success')
  },

  async saveSettings(patch) {
    const settings = await window.electronAPI.saveSettings(patch)
    set({ settings })
  },

  async resetSettings() {
    const settings = await window.electronAPI.resetSettings()
    set({ settings })
    get().setStatus('Settings reset to defaults.', 'success')
  }
    }),
    {
      limit: 100,
      partialize: (state) => ({ subtitles: state.subtitles }),
      equality: (past, current) => past.subtitles === current.subtitles
    }
  )
)

type SetState = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void
type GetState = () => AppState

/** Tracked slice of the undo/redo history (only subtitle edits). */
type TrackedState = { subtitles: Subtitle[] }

/** Subscribe to the undo/redo (zundo temporal) store from React components. */
export function useTemporalStore<T>(selector: (state: TemporalState<TrackedState>) => T): T {
  return useStore(useAppStore.temporal, selector)
}

/** Update a single chunk by id and return the new chunk array. */
function patchChunk(get: GetState, chunkId: number, patch: Partial<Chunk>): Chunk[] {
  return get().chunks.map((c) => (c.id === chunkId ? { ...c, ...patch } : c))
}

/** Build a resume snapshot from current state. */
function buildSession(get: GetState): SessionData | null {
  const { file, detection, glossary, styleGuide, genderRef, subtitles, chunks } = get()
  if (!file) return null
  return {
    version: '2.1',
    filename: file.filename,
    totalSubtitles: subtitles.length,
    totalChunks: chunks.length,
    updatedAt: new Date().toISOString(),
    detection,
    glossary,
    styleGuide,
    genderReference: genderRef,
    chunks: chunks.map((c) => ({
      id: c.id,
      status: c.status,
      completedAt: c.completedAt,
      error: c.error
    })),
    subtitles: subtitles
      .filter((s) => s.translation.trim() !== '')
      .map((s) => ({ id: s.id, translation: s.translation, status: s.status, confidence: s.confidence }))
  }
}

/** Persist the session to disk (best-effort, never throws). */
async function persistSession(get: GetState): Promise<void> {
  const file = get().file
  const data = buildSession(get)
  if (!file || !data) return
  try {
    await window.electronAPI.saveSession(file.originalPath, data)
  } catch {
    // Persistence is best-effort; the source file is never at risk.
  }
}

/** Drive the chunk translation loop from `startIndex`, with QA + persistence. */
async function runTranslation(set: SetState, get: GetState, startIndex: number): Promise<void> {
  const settings = get().settings!
  set({ isTranslating: true, isPaused: false })
  useAppStore.temporal.getState().pause()
  const total = get().chunks.length
  let sinceReview = 0
  get().setModuleStatus('translate', 'running', `chunk ${startIndex + 1}/${total}`, {
    current: startIndex,
    total
  })

  for (let i = startIndex; i < total; i++) {
    if (get().isPaused) {
      get().setModuleStatus('translate', 'running', 'paused', { current: i, total })
      break
    }
    const chunk = get().chunks[i]
    if (chunk.status === 'completed' || chunk.status === 'skipped') continue

    await runChunk(set, get, i)
    get().setModuleStatus('translate', 'running', `chunk ${i + 1}/${total}`, { current: i + 1, total })

    if (get().chunks[i].status === 'completed') {
      sinceReview += 1
      if (
        settings.translation.runReviewerAgent &&
        sinceReview >= settings.translation.reviewerFrequency
      ) {
        await reviewWindow(set, get, i, sinceReview)
        sinceReview = 0
      }
    }

    if (i < total - 1) await sleep(settings.api.batchDelay)
  }

  set({ isTranslating: false })
  useAppStore.temporal.getState().resume()
  await persistSession(get)
  await get().refreshProviderStatus()
  if (get().isPaused) {
    get().setModuleStatus('translate', 'running', 'paused')
  } else {
    const failed = get().chunks.filter((c) => c.status === 'failed').length
    get().setModuleStatus(
      'translate',
      failed > 0 ? 'error' : 'done',
      failed > 0 ? `${failed} chunk(s) failed` : 'complete'
    )
    if (!get().isPaused) get().setStatus('Translation finished.', 'success')
  }
}

/** Run the Reviewer agent over the last `count` completed chunks ending at index. */
async function reviewWindow(
  set: SetState,
  get: GetState,
  endIndex: number,
  count: number
): Promise<void> {
  const chunks = get().chunks
  const startIndex = Math.max(0, endIndex - count + 1)
  const fromSub = chunks[startIndex].startIndex
  const toSub = chunks[endIndex].endIndex
  const lines = get()
    .subtitles.slice(fromSub, toSub + 1)
    .filter((s) => s.translation.trim() !== '')
    .map((s) => ({ id: s.id, original: s.original, translation: s.translation }))
  if (lines.length === 0) return

  try {
    const result = await runReviewerAgent(lines, get().glossary, get().styleGuide)
    set((state) => ({
      qaIssues: [...state.qaIssues, ...result.issues],
      qaScore: result.overall_quality_score ?? state.qaScore
    }))
    if (result.issues.length > 0) {
      get().setStatus(`QA flagged ${result.issues.length} issue(s) in recent chunks.`, 'warning')
    }
  } catch {
    // QA is best-effort and never blocks translation.
  }
}

/** Gender-only pass: fix Hebrew conjugation per chunk using aligned reference cues. */
async function runGenderFixAll(
  set: SetState,
  get: GetState,
  cues: import('@shared/types').GenderCue[]
): Promise<void> {
  const settings = get().settings!
  const chunks = get().chunks
  let fixed = 0
  const total = chunks.length

  get().setModuleStatus('gender', 'running', `chunk 1/${total}`, { current: 0, total })

  for (let i = 0; i < chunks.length; i++) {
    if (get().isPaused) {
      get().setModuleStatus('gender', 'running', 'paused', { current: i, total })
      break
    }
    get().setModuleStatus('gender', 'running', `chunk ${i + 1}/${total}`, { current: i + 1, total })
    get().setStatus(`Gender fix: chunk ${i + 1}/${total}…`, 'info')

    try {
      const map = await fixGenderChunk({
        subtitles: get().subtitles,
        chunks,
        chunkIndex: i,
        genderCues: cues,
        provider: settings.api.preferredProvider
      })
      if (map.size > 0) {
        set({ subtitles: applyGenderFixes(get().subtitles, map) })
        fixed += map.size
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      get().setStatus(`Gender fix chunk ${i + 1} failed: ${message}`, 'warning')
    }

    if (i < chunks.length - 1) await sleep(settings.api.batchDelay)
  }

  if (get().isPaused) {
    get().setModuleStatus('gender', 'running', 'paused')
  } else {
    get().setModuleStatus('gender', 'done', `${fixed} line(s) fixed`)
    get().setStatus(`Gender fix done — ${fixed} line(s) updated.`, 'success')
  }
}

/** Translate one chunk (with retries) and fold the result into the store. */
async function runChunk(set: SetState, get: GetState, index: number): Promise<void> {
  const settings = get().settings!
  const chunk = get().chunks[index]

  set({ chunks: patchChunk(get, chunk.id, { status: 'active', error: null }) })
  get().setStatus(`Translating chunk ${index + 1}/${get().chunks.length}…`, 'info')

  const maxRetries = settings.api.maxRetries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const map = await translateChunk({
        subtitles: get().subtitles,
        chunks: get().chunks,
        chunkIndex: index,
        sourceLang: settings.translation.defaultSourceLang,
        targetLang: settings.translation.defaultTargetLang,
        contentType: get().detection?.contentType ?? 'movie',
        styleGuide: get().styleGuide,
        glossary: get().glossary,
        provider: settings.api.preferredProvider,
        contextSize: settings.chunks.contextBridgeSize,
        previewSize: settings.chunks.previewBridgeSize,
        genderCues: get().genderRef?.cues
      })

      set({
        subtitles: applyTranslations(get().subtitles, map),
        chunks: patchChunk(get, chunk.id, {
          status: 'completed',
          translatedCount: chunk.totalCount,
          completedAt: new Date().toISOString()
        })
      })
      void persistSession(get)
      return
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (attempt < maxRetries) {
        get().setStatus(`Chunk ${index + 1} failed (${message}). Retrying…`, 'warning')
        await sleep(settings.api.batchDelay)
        continue
      }
      set({
        chunks: patchChunk(get, chunk.id, { status: 'failed', error: message })
      })
      get().setStatus(`Chunk ${index + 1} failed: ${message}`, 'error')
    }
  }
}
