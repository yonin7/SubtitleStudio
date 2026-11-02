import type {
  AIProviderId,
  AIRequest,
  AIResponse,
  AIProviderState,
  AiNotice,
  KeyProviderId
} from '@shared/types'
import { DEFAULT_FALLBACK_ORDER } from '@shared/constants'
import type { Provider } from './types'
import { ProviderError } from './errors'
import { createGeminiProvider } from './geminiProvider'
import { createGroqProvider } from './groqProvider'

const providers: Record<AIProviderId, Provider> = {
  'gemini-flash-lite': createGeminiProvider('gemini-flash-lite', 'gemini-2.5-flash-lite', 1000),
  'gemini-flash': createGeminiProvider('gemini-flash', 'gemini-2.5-flash', 250),
  groq: createGroqProvider('llama-3.3-70b-versatile', 500)
}

interface Usage {
  usedToday: number
  lastReset: string
  lastError: string | null
}

const usage: Record<AIProviderId, Usage> = {
  'gemini-flash-lite': blankUsage(),
  'gemini-flash': blankUsage(),
  groq: blankUsage()
}

function blankUsage(): Usage {
  return { usedToday: 0, lastReset: '', lastError: null }
}

/** Default cooldown when a 429 carries no Retry-After (RPM windows reset ~1 min). */
const DEFAULT_RATE_COOLDOWN_MS = 20000
/** Cap on a single wait while every key is cooling. */
const MAX_WAIT_MS = 30000
/** Total time a single call may spend waiting on cooldowns before giving up. */
const MAX_TOTAL_WAIT_MS = 90000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const todayUtc = () => new Date().toISOString().slice(0, 10)
const seconds = (ms: number) => Math.ceil(ms / 1000)

function ensureDailyReset(id: AIProviderId): void {
  if (usage[id].lastReset !== todayUtc()) {
    usage[id].usedToday = 0
    usage[id].lastReset = todayUtc()
  }
}

function recordUsage(id: AIProviderId): void {
  ensureDailyReset(id)
  usage[id].usedToday += 1
  usage[id].lastError = null
}

/** Provider order: preferred first, then the rest of the fallback chain. */
function resolveOrder(preferred: AIProviderId, fallback: boolean): AIProviderId[] {
  if (!fallback) return [preferred]
  return [preferred, ...DEFAULT_FALLBACK_ORDER.filter((p) => p !== preferred)]
}

export interface CallOptions {
  fallback?: boolean
  /** Optional sink for transient notices (cooldown waits) for the UI. */
  onNotice?: (notice: AiNotice) => void
}

/**
 * Call the AI with per-KEY rotation across providers. Each key carries its own
 * cooldown (rate limit) or daily-exhaustion state, so a 429 on one key simply
 * advances to the next ready key — across all of a provider's keys and then the
 * fallback chain. When every usable key is briefly cooling we wait for the
 * soonest one (up to a budget) instead of failing.
 */
export async function callAI(request: AIRequest, options: CallOptions = {}): Promise<AIResponse> {
  const fallback = options.fallback ?? true
  const preferred = request.provider ?? 'gemini-flash-lite'
  const order = resolveOrder(preferred, fallback)

  let lastError: ProviderError | null = null
  let waited = 0

  for (;;) {
    const usable = order.filter((id) => providers[id].hasUsableToday())
    if (usable.length === 0) break // every key spent for today

    const ready = usable.filter((id) => providers[id].hasReadyKey())
    if (ready.length === 0) {
      const wait = Math.min(MAX_WAIT_MS, ...usable.map((id) => providers[id].readyInMs()))
      if (!Number.isFinite(wait) || waited + wait > MAX_TOTAL_WAIT_MS) break
      options.onNotice?.({
        kind: 'waiting',
        ms: wait,
        message: `All keys cooling down — waiting ${seconds(wait)}s…`
      })
      await sleep(wait)
      waited += wait
      continue
    }

    for (const id of ready) {
      try {
        const result = await providers[id].call(
          request.system,
          request.user,
          request.temperature ?? 0.3
        )
        recordUsage(id)
        return { text: result.text, provider: id, model: result.model }
      } catch (err) {
        const e =
          err instanceof ProviderError ? err : new ProviderError('API_NETWORK_ERROR', String(err), id)
        lastError = e
        usage[id].lastError = e.message
        console.warn(`[AI] ${id} ${e.code}: ${e.message}`)

        if (e.code === 'API_QUOTA_EXCEEDED') {
          providers[id].retireActiveKey() // daily quota → spend this key for today
        } else if (e.code === 'API_KEY_INVALID') {
          providers[id].retireActiveKey()
          options.onNotice?.({
            kind: 'parked',
            provider: id,
            ms: 0,
            message: `${id}: a key was rejected — skipping it`
          })
        } else if (e.code === 'API_RATE_LIMITED') {
          providers[id].cooldownActiveKey(e.retryAfterMs ?? DEFAULT_RATE_COOLDOWN_MS)
        } else {
          providers[id].cooldownActiveKey(2000) // transient / network
        }
      }
    }
  }

  throw (
    lastError ?? new ProviderError('ALL_PROVIDERS_FAILED', 'No AI provider is configured (check API keys)')
  )
}

/** AI providers backed by each key-provider's credentials. */
const AI_PROVIDERS_BY_KEY: Record<KeyProviderId, AIProviderId[]> = {
  gemini: ['gemini-flash-lite', 'gemini-flash'],
  groq: ['groq'],
  tmdb: []
}

/**
 * Clear the "exhausted today" / cooldown state for the AI providers backed by a
 * key-provider. Called when keys are added or removed so freshly-supplied keys
 * are tried immediately instead of staying parked from an earlier exhaustion.
 */
export function resetProviderQuota(keyProvider: KeyProviderId): void {
  for (const id of AI_PROVIDERS_BY_KEY[keyProvider]) {
    usage[id].lastError = null
    providers[id].resetKeys()
  }
}

/** Current key presence and usage for each provider (for the UI). */
export function getProviderStatus(): AIProviderState[] {
  return (Object.keys(providers) as AIProviderId[]).map((id) => {
    ensureDailyReset(id)
    return {
      id,
      hasKey: providers[id].isConfigured(),
      keyCount: providers[id].keyCount(),
      usedToday: usage[id].usedToday,
      dailyLimit: providers[id].dailyLimit,
      lastReset: usage[id].lastReset,
      lastError: usage[id].lastError
    }
  })
}
