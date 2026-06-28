import type { MemorySearchResult, VectorEntry } from '../types'

/** Hash-based sparse vector: no dependencies, deterministic, ~O(n) search. */
export function textToVector(text: string, dims = 128): number[] {
  const vector = new Array<number>(dims).fill(0)
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0)
  for (const word of words) {
    let charCodeSum = 0
    for (let i = 0; i < word.length; i++) charCodeSum += word.charCodeAt(i)
    vector[charCodeSum % dims] += 1
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (norm === 0) return vector
  return vector.map((v) => v / norm)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function semanticSearch(
  query: string,
  entries: VectorEntry[],
  topK: number,
): MemorySearchResult[] {
  const queryVector = textToVector(query)
  return entries
    .map((entry) => ({ entry, score: cosineSimilarity(queryVector, entry.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}
