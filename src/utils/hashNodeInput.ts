function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    )
    const sorted: Record<string, unknown> = {}
    for (const [key, val] of entries) sorted[key] = sortKeysDeep(val)
    return sorted
  }
  return value
}

function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

/** Pure, synchronous structural hash — no crypto API, stable key order. */
export function hashNodeInput(input: unknown): string {
  return djb2(JSON.stringify(sortKeysDeep(input)))
}
