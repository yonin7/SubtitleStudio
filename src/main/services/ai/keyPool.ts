/**
 * A rotating pool of API keys parsed from a single source. Multiple keys can be
 * supplied (e.g. `GEMINI_API_KEY=k1,k2,k3`) to multiply the free-tier ceiling.
 *
 * State is tracked PER KEY, not per provider, so a rate limit on one key only
 * parks that key — the next ready key is used immediately. Two states exist:
 *   - cooldown: a transient pause (rate limit / network), with an expiry time.
 *   - exhausted: spent for the rest of the day (daily quota / invalid key).
 * Both reset at the UTC day flip or when keys are added/removed.
 */
export interface KeyPool {
  isConfigured(): boolean
  size(): number
  /** A key usable right now (not cooling, not exhausted); '' if none ready. */
  ready(): string
  /** Whether any key is still usable today (even if currently cooling). */
  hasUsableToday(): boolean
  /** Whether a key is ready to use this instant. */
  hasReady(): boolean
  /** ms until the soonest non-exhausted key is ready (0 now, Infinity if none). */
  readyInMs(): number
  /** Put the most recently returned key on cooldown for `ms`. */
  cooldownCurrent(ms: number): void
  /** Mark the most recently returned key exhausted for the rest of the day. */
  retireCurrent(): void
  /** Clear all cooldown/exhaustion state (e.g. when keys change). */
  reset(): void
}

const today = (): string => new Date().toISOString().slice(0, 10)

export function createKeyPool(getRaw: () => string): KeyPool {
  const cooldownUntil = new Map<number, number>()
  const exhausted = new Set<number>()
  let exhaustedDay = ''
  let index = 0

  const keys = (): string[] =>
    getRaw()
      .split(/[,\s]+/)
      .map((k) => k.trim())
      .filter(Boolean)

  const resetIfNewDay = (): void => {
    if (exhaustedDay !== today()) {
      exhaustedDay = today()
      exhausted.clear()
      cooldownUntil.clear()
      index = 0
    }
  }

  const isReady = (i: number): boolean =>
    !exhausted.has(i) && (cooldownUntil.get(i) ?? 0) <= Date.now()

  return {
    isConfigured: () => keys().length > 0,
    size: () => keys().length,

    ready() {
      resetIfNewDay()
      const all = keys()
      for (let n = 0; n < all.length; n++) {
        const i = (index + n) % all.length
        if (isReady(i)) {
          index = i
          return all[i]
        }
      }
      return ''
    },

    hasUsableToday() {
      resetIfNewDay()
      return keys().some((_, i) => !exhausted.has(i))
    },

    hasReady() {
      resetIfNewDay()
      return keys().some((_, i) => isReady(i))
    },

    readyInMs() {
      resetIfNewDay()
      let soonest = Infinity
      keys().forEach((_, i) => {
        if (exhausted.has(i)) return
        const wait = Math.max(0, (cooldownUntil.get(i) ?? 0) - Date.now())
        if (wait < soonest) soonest = wait
      })
      return soonest
    },

    cooldownCurrent(ms) {
      resetIfNewDay()
      if (keys().length === 0) return
      cooldownUntil.set(index, Date.now() + Math.max(0, ms))
    },

    retireCurrent() {
      resetIfNewDay()
      if (keys().length === 0) return
      exhausted.add(index)
    },

    reset() {
      exhausted.clear()
      cooldownUntil.clear()
      exhaustedDay = today()
      index = 0
    }
  }
}
