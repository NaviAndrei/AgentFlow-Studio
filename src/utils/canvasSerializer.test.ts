import { describe, expect, it, vi } from 'vitest'
import { parseCanvas, serializeCanvas } from './canvasSerializer'
import type { AgentFlowEdge, AgentFlowNode } from '../types'

// The validators warn on rejection; keep test output clean.
vi.spyOn(console, 'warn').mockImplementation(() => undefined)

const sampleNodes: AgentFlowNode[] = [
  { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
  { id: 'llm-1', type: 'llm', position: { x: 200, y: 0 }, data: { label: 'LLM' } },
]

const sampleEdges: AgentFlowEdge[] = [
  { id: 'e1', source: 'start-1', target: 'llm-1', type: 'agentflow', animated: true, label: 'go' },
]

describe('canvasSerializer', () => {
  it('round-trips nodes and edges by id', () => {
    const doc = serializeCanvas(sampleNodes, sampleEdges)
    const { nodes, edges } = parseCanvas(JSON.stringify(doc))
    expect(nodes.map((n) => n.id).sort()).toEqual(
      sampleNodes.map((n) => n.id).sort(),
    )
    expect(edges.map((e) => e.id).sort()).toEqual(
      sampleEdges.map((e) => e.id).sort(),
    )
  })

  it('throws a plain string (not an Error) on invalid JSON', () => {
    let caught: unknown
    try {
      parseCanvas('not json')
    } catch (error) {
      caught = error
    }
    expect(typeof caught).toBe('string')
  })

  it('skips a node with an unknown type and parses the rest', () => {
    const doc = serializeCanvas(sampleNodes, sampleEdges)
    const raw = JSON.stringify({
      ...doc,
      nodes: [
        ...doc.nodes,
        {
          id: 'future-1',
          type: 'unknown_future_type',
          position: { x: 0, y: 0 },
          data: { label: 'Future' },
        },
      ],
    })
    const { nodes } = parseCanvas(raw)
    expect(nodes.map((n) => n.id)).not.toContain('future-1')
    expect(nodes).toHaveLength(sampleNodes.length)
  })
})
