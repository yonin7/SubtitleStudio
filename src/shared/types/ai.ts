/** Logical AI providers, in the order they appear in the fallback chain. */
export type AIProviderId = 'gemini-flash-lite' | 'gemini-flash' | 'groq'

/** A generic chat-style request sent to any provider from the main process. */
export interface AIRequest {
  system: string
  user: string
  temperature?: number
  /** Preferred provider; the manager may fall back to others. */
  provider?: AIProviderId
}

export interface AIResponse {
  text: string
  provider: AIProviderId
  model: string
}

/** Per-provider runtime usage/quota tracking. */
export interface AIProviderState {
  id: AIProviderId
  hasKey: boolean
  /** Number of configured API keys (1 unless key rotation is set up). */
  keyCount: number
  usedToday: number
  dailyLimit: number
  lastReset: string | null
  lastError: string | null
}

/** Structured error codes surfaced from the AI layer. */
export type AIErrorCode =
  | 'API_KEY_INVALID'
  | 'API_QUOTA_EXCEEDED'
  | 'API_RATE_LIMITED'
  | 'API_JSON_PARSE_FAIL'
  | 'API_NETWORK_ERROR'
  | 'API_COUNT_MISMATCH'
  | 'ALL_PROVIDERS_FAILED'

export interface AIError {
  code: AIErrorCode
  message: string
  provider?: AIProviderId
}

/** Providers that consume an API key (translation + optional metadata). */
export type KeyProviderId = 'gemini' | 'groq' | 'tmdb'

/** Masked, renderer-safe view of the keys configured for a provider. */
export interface ApiKeyInfo {
  provider: KeyProviderId
  /** Number of keys supplied via the local .env file (read-only). */
  envCount: number
  /** Masked in-app keys (e.g. "••••AB12"), editable from Settings. */
  stored: string[]
}

/** A transient notice pushed from the AI layer to the UI (e.g. cooldown waits). */
export interface AiNotice {
  kind: 'waiting' | 'parked'
  /** Provider involved, when applicable. */
  provider?: AIProviderId
  /** Cooldown / wait duration in ms. */
  ms: number
  message: string
}
