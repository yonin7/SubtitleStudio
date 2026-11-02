/** Remove markdown code fences and surrounding noise from an LLM response. */
export function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

/**
 * Parse an LLM response expected to be a JSON array. Tolerates code fences and
 * leading/trailing prose by extracting the outermost [...] span as a fallback.
 */
export function parseJsonArray<T = unknown>(raw: string): T[] {
  const cleaned = stripCodeFences(raw)
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Expected a JSON array')
    return parsed as T[]
  } catch {
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1))
      if (Array.isArray(parsed)) return parsed as T[]
    }
    throw new Error('Response was not a valid JSON array')
  }
}

/** Parse an LLM response expected to be a JSON object. */
export function parseJsonObject<T = unknown>(raw: string): T {
  const cleaned = stripCodeFences(raw)
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T
    }
    throw new Error('Response was not valid JSON')
  }
}
