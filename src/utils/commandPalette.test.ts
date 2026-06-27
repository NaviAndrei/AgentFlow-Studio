import { describe, expect, it } from 'vitest'
import { filterNodesBySearch, parseNodeSearchQuery, scoreCommand } from './commandPalette'
import type { PaletteCommand } from './commandPalette'

function cmd(label: string, keywords: string[] = []): PaletteCommand {
  return { id: label, label, keywords, group: 'Canvas', action: () => {} }
}

describe('scoreCommand', () => {
  it('returns 0 when the query matches neither the label nor any keyword', () => {
    expect(scoreCommand(cmd('Clear Canvas'), 'zzz')).toBe(0)
  })

  it('returns 3 for a starts-with match on the label', () => {
    expect(scoreCommand(cmd('Clear Canvas'), 'clear')).toBe(3)
  })

  it('returns 1 for an empty query (show-all case)', () => {
    expect(scoreCommand(cmd('Clear Canvas'), '')).toBe(1)
  })
})

describe('parseNodeSearchQuery', () => {
  it('extracts the search term after the "nodes:" prefix', () => {
    expect(parseNodeSearchQuery('nodes: router')).toBe('router')
  })

  it('returns null when the query has no "nodes:" prefix', () => {
    expect(parseNodeSearchQuery('clear canvas')).toBeNull()
  })
})

describe('filterNodesBySearch', () => {
  const nodes = [
    { type: 'llm', data: { label: 'Summarizer' } },
    { type: 'router', data: { label: 'Branch A' } },
    { type: 'output', data: { label: 'Final' } },
  ]

  it('matches by node label substring (case-insensitive)', () => {
    expect(filterNodesBySearch(nodes, 'branch')).toEqual([nodes[1]])
  })

  it('matches by node type substring', () => {
    expect(filterNodesBySearch(nodes, 'llm')).toEqual([nodes[0]])
  })
})
