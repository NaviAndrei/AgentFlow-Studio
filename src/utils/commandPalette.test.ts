import { describe, expect, it } from 'vitest'
import { scoreCommand } from './commandPalette'
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
