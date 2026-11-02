import Store from 'electron-store'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

const store = new Store<{ settings: Partial<AppSettings> }>({ name: 'subtitle-studio' })

type Plain = Record<string, unknown>
const isPlainObject = (v: unknown): v is Plain =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Recursively merge a partial patch onto a base object (arrays are replaced). */
function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch ?? base) as T
  const out: Plain = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) ? deepMerge((base as Plain)[key], value) : value
  }
  return out as T
}

export function getSettings(): AppSettings {
  return deepMerge(DEFAULT_SETTINGS, store.get('settings') ?? {})
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const merged = deepMerge(getSettings(), patch)
  store.set('settings', merged)
  return merged
}

export function resetSettings(): AppSettings {
  store.delete('settings')
  return DEFAULT_SETTINGS
}
