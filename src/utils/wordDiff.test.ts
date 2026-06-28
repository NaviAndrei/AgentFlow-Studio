import { describe, expect, it } from 'vitest'
import { wordDiff } from './wordDiff'

describe('wordDiff', () => {
  it('marks a replaced word as delete + insert', () => {
    const segs = wordDiff('hello world', 'hello earth')
    expect(segs.some((s) => s.type === 'delete' && s.text.includes('world'))).toBe(true)
    expect(segs.some((s) => s.type === 'insert' && s.text.includes('earth'))).toBe(true)
  })

  it('treats all-new text as insert', () => {
    const segs = wordDiff('', 'new text')
    expect(segs.length).toBeGreaterThan(0)
    expect(segs.every((s) => s.type === 'insert')).toBe(true)
  })

  it('returns a single equal segment for identical text', () => {
    const segs = wordDiff('same', 'same')
    expect(segs).toHaveLength(1)
    expect(segs[0].type).toBe('equal')
  })

  it('detects a removed middle word', () => {
    const segs = wordDiff('a b c', 'a c')
    expect(segs.some((s) => s.type === 'delete' && s.text.includes('b'))).toBe(true)
  })
})
