import { describe, expect, it } from 'vitest'
import { hashNodeInput } from './hashNodeInput'

describe('hashNodeInput', () => {
  it('returns the same hash for structurally identical input regardless of key order', () => {
    const a = hashNodeInput({ foo: 1, bar: { z: 1, a: 2 } })
    const b = hashNodeInput({ bar: { a: 2, z: 1 }, foo: 1 })
    expect(a).toBe(b)
  })

  it('returns different hashes for different input', () => {
    const a = hashNodeInput({ foo: 1 })
    const b = hashNodeInput({ foo: 2 })
    expect(a).not.toBe(b)
  })

  it('is deterministic across repeated calls', () => {
    const input = { a: [1, 2, 3], b: 'x' }
    expect(hashNodeInput(input)).toBe(hashNodeInput(input))
  })
})
