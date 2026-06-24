import { beforeEach, describe, expect, it } from 'vitest'
import { useMemoryStore } from './memoryStore'

beforeEach(() => {
  useMemoryStore.setState({ entries: {} })
})

describe('memoryStore', () => {
  it('starts with no entries', () => {
    expect(useMemoryStore.getState().entries).toEqual({})
    expect(useMemoryStore.getState().read('anything')).toEqual([])
  })

  it('round-trips a write through read', () => {
    useMemoryStore.getState().write('user_memories', 'likes dark mode')
    expect(useMemoryStore.getState().read('user_memories')).toEqual([
      'likes dark mode',
    ])
  })

  it('appends multiple writes to the same key instead of overwriting', () => {
    useMemoryStore.getState().write('user_memories', 'first fact')
    useMemoryStore.getState().write('user_memories', 'second fact')
    expect(useMemoryStore.getState().read('user_memories')).toEqual([
      'first fact',
      'second fact',
    ])
  })

  it('keeps separate namespaces independent', () => {
    useMemoryStore.getState().write('a', 'value-a')
    useMemoryStore.getState().write('b', 'value-b')
    expect(useMemoryStore.getState().read('a')).toEqual(['value-a'])
    expect(useMemoryStore.getState().read('b')).toEqual(['value-b'])
  })

  it('clear empties all entries', () => {
    useMemoryStore.getState().write('user_memories', 'fact')
    useMemoryStore.getState().clear()
    expect(useMemoryStore.getState().entries).toEqual({})
    expect(useMemoryStore.getState().read('user_memories')).toEqual([])
  })
})
