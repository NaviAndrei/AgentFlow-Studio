import type { EvalResult, EvalTestCase } from '../types'

function wordOverlap(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ''))
        .filter((w) => w.length > 0),
    )
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 && setB.size === 0) return 0
  let intersection = 0
  for (const w of setA) if (setB.has(w)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function scoreTestCase(
  testCase: EvalTestCase,
  actualOutput: string,
): EvalResult {
  const expected = testCase.expectedOutput.toLowerCase()
  const actual = actualOutput.toLowerCase()
  if (expected.length > 0 && actual.includes(expected)) {
    return {
      testCaseId: testCase.id,
      status: 'pass',
      actualOutput,
      score: 1,
    }
  }
  const overlap = wordOverlap(actual, expected)
  if (overlap >= 0.4) {
    return {
      testCaseId: testCase.id,
      status: 'partial',
      actualOutput,
      score: 0.5,
    }
  }
  return {
    testCaseId: testCase.id,
    status: 'fail',
    actualOutput,
    score: 0,
  }
}

export function computeQualityScore(results: EvalResult[]): number {
  if (results.length === 0) return 0
  const total = results.reduce((sum, r) => sum + r.score, 0)
  return Math.round((total / results.length) * 100)
}
