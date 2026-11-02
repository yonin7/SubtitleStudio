import type { AIErrorCode, AIProviderId } from '@shared/types'

/** A typed error carrying a stable code for the fallback logic to branch on. */
export class ProviderError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public provider?: AIProviderId,
    /** Server-requested cooldown (ms), when the provider supplied `Retry-After`. */
    public retryAfterMs: number | null = null
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

/** Extract Gemini's `RetryInfo.retryDelay` (e.g. "21s") from an error body. */
function parseRetryDelayBody(body: string): number | null {
  const match = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i)
  return match ? Math.round(parseFloat(match[1]) * 1000) : null
}

/**
 * A 429 is only true *daily* exhaustion when recovery is far off. The wording in
 * the body is unreliable — Gemini's free-tier per-minute throttle returns 429
 * bodies that mention "PerDay" quota ids too. The decisive signal is the
 * server-supplied retry delay: a short one (seconds–minutes) is a transient rate
 * limit; only a long delay (≳ 15 min) or none-with-daily-wording is exhaustion.
 */
const DAILY_THRESHOLD_MS = 15 * 60 * 1000

function mentionsDailyQuota(body: string): boolean {
  return /per[\s_-]?day|requests per day|daily limit|perday/i.test(body)
}

/** Map an HTTP response to a structured provider error. */
export function classifyHttpError(
  status: number,
  body: string,
  provider: AIProviderId,
  retryAfterMs: number | null = null
): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('API_KEY_INVALID', `Invalid API key (HTTP ${status})`, provider)
  }
  if (status === 429) {
    const cooldown = retryAfterMs ?? parseRetryDelayBody(body)
    // Daily exhaustion only when there is no short recovery window.
    const isDaily =
      (cooldown === null && mentionsDailyQuota(body)) || (cooldown !== null && cooldown >= DAILY_THRESHOLD_MS)
    return isDaily
      ? new ProviderError('API_QUOTA_EXCEEDED', `Daily quota exhausted (HTTP 429)`, provider, cooldown)
      : new ProviderError(
          'API_RATE_LIMITED',
          `Rate limited — too many requests (HTTP 429)`,
          provider,
          cooldown
        )
  }
  return new ProviderError('API_NETWORK_ERROR', `Provider error HTTP ${status}: ${body.slice(0, 200)}`, provider)
}
