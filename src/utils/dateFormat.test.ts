import { describe, expect, it } from 'vitest'
import { hasVisibleNote, getRelativeTime, getAbsoluteTime } from './dateFormat'

describe('hasVisibleNote', () => {
  it('returns false for undefined', () => {
    expect(hasVisibleNote(undefined)).toBe(false)
  })

  it('returns false for empty string — note badge must not appear in DOM', () => {
    expect(hasVisibleNote('')).toBe(false)
  })

  it('returns false for whitespace-only string — note badge must not appear in DOM', () => {
    expect(hasVisibleNote('   ')).toBe(false)
  })

  it('returns false for tab and newline whitespace', () => {
    expect(hasVisibleNote('\t\n')).toBe(false)
  })

  it('returns true for a note with visible content', () => {
    expect(hasVisibleNote('initial draft')).toBe(true)
  })

  it('returns true for a note with leading/trailing whitespace around content', () => {
    expect(hasVisibleNote('  fix typos  ')).toBe(true)
  })
})

describe('getRelativeTime', () => {
  it('returns "just now" for timestamps under 60 seconds ago', () => {
    expect(getRelativeTime(Date.now() - 30_000)).toBe('just now')
  })

  it('returns minutes for timestamps 1–59 minutes ago', () => {
    expect(getRelativeTime(Date.now() - 5 * 60_000)).toBe('5m ago')
  })

  it('returns hours for timestamps 1–23 hours ago', () => {
    expect(getRelativeTime(Date.now() - 3 * 3_600_000)).toBe('3h ago')
  })

  it('returns days for timestamps 1–6 days ago', () => {
    expect(getRelativeTime(Date.now() - 4 * 86_400_000)).toBe('4d ago')
  })
})

describe('getAbsoluteTime', () => {
  it('returns a non-empty locale string for a valid timestamp', () => {
    const result = getAbsoluteTime(Date.now())
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
