import { describe, expect, it } from 'vitest'
import { getLayoutedElements } from './autoLayout'
import type { AgentFlowEdge, AgentFlowNode } from '../types'

describe('getLayoutedElements', () => {
  it('lays out a 3-node chain with distinct y positions in TB mode', () => {
    const nodes: AgentFlowNode[] = [
      { id: 'a', type: 'start', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'b', type: 'llm', position: { x: 0, y: 0 }, data: { label: 'B' } },
      { id: 'c', type: 'output', position: { x: 0, y: 0 }, data: { label: 'C' } },
    ]
    const edges: AgentFlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ]

    const result = getLayoutedElements(nodes, edges, 'TB')
    const ys = result.nodes.map((n) => n.position.y)

    // Every node lands on its own rank — no two share a y-coordinate.
    expect(new Set(ys).size).toBe(3)

    // The chain flows top-to-bottom: a above b above c.
    const yById = Object.fromEntries(
      result.nodes.map((n) => [n.id, n.position.y]),
    )
    expect(yById.a).toBeLessThan(yById.b)
    expect(yById.b).toBeLessThan(yById.c)
  })
})
