import type { Provider, ProviderCallResult } from './types'
import { ProviderError, classifyHttpError } from './errors'
import { postJson } from './http'
import { createKeyPool } from './keyPool'
import { rawFor } from './keyVault'

const URL = 'https://api.groq.com/openai/v1/chat/completions'

interface GroqResponse {
  choices?: { message?: { content?: string } }[]
}

/** Groq provider (OpenAI-compatible chat completions). */
export function createGroqProvider(model: string, dailyLimit: number): Provider {
  const pool = createKeyPool(() => rawFor('groq'))

  return {
    id: 'groq',
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
      if (!key) throw new ProviderError('API_KEY_INVALID', 'GROQ_API_KEY is not set', 'groq')

      const res = await postJson(
        URL,
        {
          model,
          temperature,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        },
        { Authorization: `Bearer ${key}` },
        'groq'
      )

      if (!res.ok) throw classifyHttpError(res.status, res.text, 'groq', res.retryAfterMs)

      const data = JSON.parse(res.text) as GroqResponse
      const text = data.choices?.[0]?.message?.content ?? ''
      if (!text) throw new ProviderError('API_JSON_PARSE_FAIL', 'Empty response from Groq', 'groq')
      return { text, model }
    }
  }
}
