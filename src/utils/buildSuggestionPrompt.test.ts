import { describe, expect, it } from 'vitest'
import { buildSuggestionPrompt } from './buildSuggestionPrompt'
import type { AgentFlowNode } from '../types'

function makeNode(): AgentFlowNode {
  return {
    id: 'n1',
    type: 'llm',
    position: { x: 0, y: 0 },
    data: { label: 'Summarizer', systemPrompt: 'Summarize.' },
  }
}

describe('buildSuggestionPrompt', () => {
  it('includes the node type string', () => {
    const out = buildSuggestionPrompt(makeNode(), [])
    expect(out).toContain('llm')
  })

  it('includes connected node labels when provided', () => {
    const out = buildSuggestionPrompt(makeNode(), ['Search', 'Fetcher'])
    expect(out).toContain('Search')
    expect(out).toContain('Fetcher')
  })
})
