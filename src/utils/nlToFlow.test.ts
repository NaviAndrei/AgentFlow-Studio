import { describe, expect, it } from 'vitest'
import {
  buildNLFlowSystemPrompt,
  validateAndSanitizeFlowJSON,
} from './nlToFlow'
import type { AgentFlowNodeType } from '../types'

const TYPES = ['llm', 'tool'] as AgentFlowNodeType[]

describe('nlToFlow', () => {
  it('buildNLFlowSystemPrompt lists all valid type strings', () => {
    const out = buildNLFlowSystemPrompt(TYPES)
    expect(out).toContain('llm')
    expect(out).toContain('tool')
  })

  it('replaces an unknown node type with "unknown" + warning', () => {
    const result = validateAndSanitizeFlowJSON(
      {
        nodes: [
          { id: 'n1', type: 'nonexistent', data: { label: 'X' }, position: { x: 0, y: 0 } },
        ],
        edges: [],
      },
      TYPES,
    )
    expect(result.nodes[0].type).toBe('unknown')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('removes edges that reference a missing node', () => {
    const result = validateAndSanitizeFlowJSON(
      {
        nodes: [{ id: 'n1', type: 'llm', data: { label: 'A' }, position: { x: 0, y: 0 } }],
        edges: [{ id: 'e1', source: 'n1', target: 'ghost' }],
      },
      TYPES,
    )
    expect(result.edges).toHaveLength(0)
    expect(result.warnings.some((w) => w.includes('missing'))).toBe(true)
  })

  it('returns empty result + warning for invalid JSON string', () => {
    const result = validateAndSanitizeFlowJSON('{not valid json', TYPES)
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.warnings[0]).toContain('Parse error')
  })

  it('returns nodes unchanged with zero warnings when all types valid', () => {
    const result = validateAndSanitizeFlowJSON(
      {
        nodes: [
          { id: 'n1', type: 'llm', data: { label: 'A' }, position: { x: 0, y: 0 } },
          { id: 'n2', type: 'tool', data: { label: 'B' }, position: { x: 250, y: 0 } },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      },
      TYPES,
    )
    expect(result.warnings).toHaveLength(0)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })
})
