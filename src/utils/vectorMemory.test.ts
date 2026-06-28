import { describe, expect, it } from 'vitest'
import { cosineSimilarity, semanticSearch, textToVector } from './vectorMemory'
import type { VectorEntry } from '../types'

describe('textToVector', () => {
  it('returns an array of the default length', () => {
    expect(textToVector('hello')).toHaveLength(128)
  })
})

describe('cosineSimilarity', () => {
  it('is ~1.0 for a vector compared to itself', () => {
    const v = textToVector('hello world')
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
  })

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0)
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0)
  })
})

describe('semanticSearch', () => {
  it('returns exactly topK results sorted by score', () => {
    const entries: VectorEntry[] = [
      { id: '1', text: 'hello world', embedding: textToVector('hello world'), createdAt: 0 },
      { id: '2', text: 'goodbye moon', embedding: textToVector('goodbye moon'), createdAt: 0 },
    ]
    const results = semanticSearch('hello world', entries, 1)
    expect(results).toHaveLength(1)
    expect(results[0].entry.id).toBe('1')
  })
})
