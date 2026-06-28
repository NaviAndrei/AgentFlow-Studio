import { describe, expect, it } from 'vitest'
import { parseCSVToDataset, scoreExactMatch } from './evalScoring'

describe('scoreExactMatch', () => {
  it('is case-insensitive', () => {
    expect(scoreExactMatch('Hello', 'hello')).toBe(1)
  })

  it('returns 0 for mismatches', () => {
    expect(scoreExactMatch('yes', 'no')).toBe(0)
  })
})

describe('parseCSVToDataset', () => {
  it('parses a single row', () => {
    const ds = parseCSVToDataset('input,expected_output\nhello,world', 'test')
    expect(ds.rows).toHaveLength(1)
    expect(ds.rows[0]).toMatchObject({ input: 'hello', expectedOutput: 'world' })
  })

  it('throws when expected_output column is missing', () => {
    expect(() => parseCSVToDataset('input\nhello', 'test')).toThrow(
      'CSV must have "input" and "expected_output" columns',
    )
  })

  it('trims whitespace in values', () => {
    const ds = parseCSVToDataset('input, expected_output \n  hello  ,  world  ', 'test')
    expect(ds.rows[0]).toMatchObject({ input: 'hello', expectedOutput: 'world' })
  })
})
