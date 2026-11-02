import type { AIProviderId } from '@shared/types'
import type { Provider, ProviderCallResult } from './types'
import { ProviderError, classifyHttpError } from './errors'
import { postJson } from './http'
import { createKeyPool } from './keyPool'
import { rawFor } from './keyVault'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  promptFeedback?: { blockReason?: string }
}

/**
 * Factory for a Gemini provider. Both flash-lite and flash share one API key
 * but differ in model id and daily quota.
 */
export function createGeminiProvider(
  id: AIProviderId,
  model: string,
  dailyLimit: number
): Provider {
  const pool = createKeyPool(() => rawFor('gemini'))

  return {
    id,
    model,
    dailyLimit,
    isConfigured: () => pool.isConfigured(),
    keyCount: () => pool.size(),
    hasUsableToday: () => pool.hasUsableToday(),
    hasReadyKey: () => pool.hasReady(),
    readyInMs: () => pool.readyInMs(),
    cooldownActiveKey: (ms) => pool.cooldownCurrent(ms),
    retireActiveKey: () => pool.retireCurrent(),
    resetKeys: () => pool.reset(),
    async call(system, user, temperature): Promise<ProviderCallResult> {
      const key = pool.ready()
      if (!key) throw new ProviderError('API_KEY_INVALID', 'GEMINI_API_KEY is not set', id)

      const url = `${BASE}/${model}:generateContent?key=${key}`
      const res = await postJson(
        url,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature, responseMimeType: 'application/json' }
        },
        {},
        id
      )

      if (!res.ok) throw classifyHttpError(res.status, res.text, id, res.retryAfterMs)

      const data = JSON.parse(res.text) as GeminiResponse
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      if (!text) {
        const reason = data.promptFeedback?.blockReason
        throw new ProviderError(
          'API_JSON_PARSE_FAIL',
          reason ? `Empty response (blocked: ${reason})` : 'Empty response from Gemini',
          id
        )
      }
      return { text, model }
    }
  }
}
