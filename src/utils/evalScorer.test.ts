import { describe, expect, it } from 'vitest'
import { scoreTestCase, computeQualityScore } from './evalScorer'
import type { EvalTestCase } from '../types'

describe('scoreTestCase', () => {
  const testCase: EvalTestCase = {
    id: 'test-1',
    input: 'Tell me about React',
    expectedOutput: 'React is a library',
    description: 'Basic React info',
  }

  it('scores 1 for exact case-insensitive match or when actual includes expected', () => {
    // Exact match
    const result1 = scoreTestCase(testCase, 'React is a library')
    expect(result1).toEqual({
      testCaseId: 'test-1',
      status: 'pass',
      actualOutput: 'React is a library',
      score: 1,
    })

    // Actual contains expected
    const result2 = scoreTestCase(testCase, 'Indeed, React is a library for UI development.')
    expect(result2.score).toBe(1)
    expect(result2.status).toBe('pass')

    // Case-insensitivity check
    const result3 = scoreTestCase(testCase, 'react is a library')
    expect(result3.score).toBe(1)
    expect(result3.status).toBe('pass')
  })

  it('scores 0.5 for word overlap >= 0.4 when there is no exact containing match', () => {
    // Expected words: ['react', 'is', 'a', 'library'] -> size 4
    // Actual words: ['react', 'is', 'great'] -> size 3
    // Intersection: ['react', 'is'] -> size 2
    // Union: 4 + 3 - 2 = 5
    // Overlap: 2 / 5 = 0.4 (Exactly equal to 0.4 threshold)
    const result = scoreTestCase(testCase, 'React is great')
    expect(result).toEqual({
      testCaseId: 'test-1',
      status: 'partial',
      actualOutput: 'React is great',
      score: 0.5,
    })
  })

  it('scores 0 for word overlap < 0.4 when no match', () => {
    // Expected words: ['react', 'is', 'a', 'library'] -> size 4
    // Actual words: ['react', 'rocks'] -> size 2
    // Intersection: ['react'] -> size 1
    // Union: 4 + 2 - 1 = 5
    // Overlap: 1 / 5 = 0.2 (< 0.4)
    const result = scoreTestCase(testCase, 'React rocks')
    expect(result).toEqual({
      testCaseId: 'test-1',
      status: 'fail',
      actualOutput: 'React rocks',
      score: 0,
    })
  })

  it('handles empty input strings safely without crashing', () => {
    const emptyTestCase: EvalTestCase = {
      id: 'test-empty',
      input: 'ping',
      expectedOutput: '',
    }
    const result = scoreTestCase(emptyTestCase, '')
    // Expected is empty, actual is empty.
    // expected.length is 0, so it skips actual.includes(expected) condition.
    // Word overlap of empty sets returns 0, resulting in score 0.
    expect(result.score).toBe(0)
    expect(result.status).toBe('fail')
  })

  it('filters out punctuation during word overlap tokenization', () => {
    // Expected: 'React is a library'
    // Actual: 'React, is... a! library?'
    // Punctuation is stripped, leading to a perfect word overlap match (1.0)
    const result = scoreTestCase(testCase, 'React, is... a! library?')
    expect(result.score).toBe(0.5) // Since actual doesn't contain expected literally (because of punctuation mismatch in literal match) but has 100% word overlap
  })
})

describe('computeQualityScore', () => {
  it('returns 0 for empty results list', () => {
    expect(computeQualityScore([])).toBe(0)
  })

  it('computes rounded percentage average score', () => {
    const results = [
      { testCaseId: '1', status: 'pass' as const, actualOutput: 'a', score: 1 },
      { testCaseId: '2', status: 'partial' as const, actualOutput: 'b', score: 0.5 },
      { testCaseId: '3', status: 'fail' as const, actualOutput: 'c', score: 0 },
    ]
    // Average = (1 + 0.5 + 0) / 3 = 0.5
    // Quality Score = 50
    expect(computeQualityScore(results)).toBe(50)
  })

  it('rounds quality score to nearest integer', () => {
    const results = [
      { testCaseId: '1', status: 'pass' as const, actualOutput: 'a', score: 1 },
      { testCaseId: '2', status: 'pass' as const, actualOutput: 'b', score: 1 },
      { testCaseId: '3', status: 'fail' as const, actualOutput: 'c', score: 0 },
    ]
    // Average = 2 / 3 = 0.6666...
    // Quality Score = Math.round(66.666...) = 67
    expect(computeQualityScore(results)).toBe(67)
  })
})
