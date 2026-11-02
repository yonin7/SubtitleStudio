import type { AIProviderId } from '@shared/types'

export interface ProviderCallResult {
  text: string
  model: string
}

/** Uniform interface every AI provider implements. */
export interface Provider {
  readonly id: AIProviderId
  readonly model: string
  readonly dailyLimit: number
  /** At least one key is configured (regardless of today's state). */
  isConfigured(): boolean
  /** Number of configured keys (for the UI). */
  keyCount(): number
  /** At least one key is still usable today (even if currently cooling). */
  hasUsableToday(): boolean
  /** A key is ready to use this instant. */
  hasReadyKey(): boolean
  /** ms until the soonest key is ready (0 now, Infinity if all spent today). */
  readyInMs(): number
  /** Put the key used by the last `call` on cooldown for `ms`, then rotate. */
  cooldownActiveKey(ms: number): void
  /** Retire the key used by the last `call` for the day (daily quota / invalid). */
  retireActiveKey(): void
  /** Clear all key state (e.g. after keys are added/removed). */
  resetKeys(): void
  call(system: string, user: string, temperature: number): Promise<ProviderCallResult>
}
