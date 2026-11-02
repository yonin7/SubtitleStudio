import type { AIProviderId } from '@shared/types'
import { ProviderError } from './errors'

export interface HttpResult {
  ok: boolean
  status: number
  text: string
  /** Parsed `Retry-After` (ms) when the server asked us to back off. */
  retryAfterMs: number | null
}

/** Parse an HTTP `Retry-After` header (seconds or HTTP date) into ms. */
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}

/** POST JSON with a hard timeout, surfacing network failures as ProviderError. */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  provider: AIProviderId,
  timeoutMs = 60000
): Promise<HttpResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    return {
      ok: res.ok,
      status: res.status,
      text: await res.text(),
      retryAfterMs: parseRetryAfter(res.headers.get('retry-after'))
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new ProviderError('API_NETWORK_ERROR', `Network error: ${reason}`, provider)
  } finally {
    clearTimeout(timer)
  }
}
