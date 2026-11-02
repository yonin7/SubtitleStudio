import Store from 'electron-store'
import type { ApiKeyInfo, KeyProviderId } from '@shared/types'

/**
 * Central store for API keys. Keys can come from two sources, merged together:
 *   1. The local `.env` file (read-only here) — convenient for development.
 *   2. Keys added in-app via Settings — persisted to a dedicated store file.
 * Multiple keys per provider enable daily-quota rotation (see keyPool).
 */
const ENV_VAR: Record<KeyProviderId, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  tmdb: 'TMDB_API_KEY'
}

const PROVIDERS: KeyProviderId[] = ['gemini', 'groq', 'tmdb']

const store = new Store<{ keys: Partial<Record<KeyProviderId, string[]>> }>({
  name: 'subtitle-studio-keys'
})

const parse = (raw: string): string[] =>
  raw
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean)

const envKeys = (p: KeyProviderId): string[] => parse(process.env[ENV_VAR[p]] ?? '')
const storedKeys = (p: KeyProviderId): string[] => store.get('keys')?.[p] ?? []

/** All keys for a provider (env first, then stored), de-duplicated. */
function combined(p: KeyProviderId): string[] {
  return Array.from(new Set([...envKeys(p), ...storedKeys(p)]))
}

/** Comma-joined keys for the rotating key pool. */
export function rawFor(p: KeyProviderId): string {
  return combined(p).join(',')
}

/** The first usable key (for providers that don't rotate, e.g. TMDB). */
export function firstKey(p: KeyProviderId): string {
  return combined(p)[0] ?? ''
}

function persist(p: KeyProviderId, keys: string[]): void {
  const all = { ...(store.get('keys') ?? {}) }
  all[p] = keys
  store.set('keys', all)
}

export function addKey(p: KeyProviderId, key: string): void {
  const trimmed = key.trim()
  if (!trimmed) return
  const stored = storedKeys(p)
  if (stored.includes(trimmed) || envKeys(p).includes(trimmed)) return
  persist(p, [...stored, trimmed])
}

export function removeKey(p: KeyProviderId, index: number): void {
  const stored = storedKeys(p)
  if (index < 0 || index >= stored.length) return
  persist(
    p,
    stored.filter((_, i) => i !== index)
  )
}

const mask = (key: string): string => (key.length <= 4 ? '••••' : `••••${key.slice(-4)}`)

/** Masked summary for the Settings UI (full keys are never sent to the renderer). */
export function info(): ApiKeyInfo[] {
  return PROVIDERS.map((provider) => ({
    provider,
    envCount: envKeys(provider).length,
    stored: storedKeys(provider).map(mask)
  }))
}
