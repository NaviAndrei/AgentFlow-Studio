export type DiffSegmentType = 'equal' | 'insert' | 'delete'
export interface DiffSegment {
  type: DiffSegmentType
  text: string
}

/**
 * Word-level diff between two strings. Whitespace runs are kept as their own
 * tokens so the rebuilt text round-trips exactly. Uses a classic LCS table and
 * backtrack; adjacent same-type segments are coalesced.
 */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldTokens = oldText.split(/(\s+)/).filter((t) => t !== '')
  const newTokens = newText.split(/(\s+)/).filter((t) => t !== '')
  const n = oldTokens.length
  const m = newTokens.length

  // lcs[i][j] = length of LCS of oldTokens[i:] and newTokens[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        oldTokens[i] === newTokens[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const raw: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (oldTokens[i] === newTokens[j]) {
      raw.push({ type: 'equal', text: oldTokens[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      raw.push({ type: 'delete', text: oldTokens[i] })
      i++
    } else {
      raw.push({ type: 'insert', text: newTokens[j] })
      j++
    }
  }
  while (i < n) raw.push({ type: 'delete', text: oldTokens[i++] })
  while (j < m) raw.push({ type: 'insert', text: newTokens[j++] })

  // Coalesce adjacent same-type segments.
  const out: DiffSegment[] = []
  for (const seg of raw) {
    const last = out[out.length - 1]
    if (last && last.type === seg.type) last.text += seg.text
    else out.push({ ...seg })
  }
  return out
}
