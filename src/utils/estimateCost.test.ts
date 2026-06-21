import { describe, expect, it } from 'vitest'
import type { AgentFlowNode } from '../types'
import { estimatePreRunCost } from './estimateCost'

function node(
  id: string,
  type: AgentFlowNode['type'],
  data: Partial<AgentFlowNode['data']> & { label: string },
): AgentFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as AgentFlowNode
}

describe('estimatePreRunCost', () => {
  it('returns zero count and zero cost for a canvas with no LLM-invoking nodes', () => {
    const nodes = [node('s', 'start', { label: 'Start' }), node('o', 'output', { label: 'Out' })]
    const estimate = estimatePreRunCost(nodes, 'gpt-4o-mini')
    expect(estimate.count).toBe(0)
    expect(estimate.estimatedCostUsd).toBe(0)
  })

  it('counts each LLM-invoking node type and produces a positive estimate', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Agent', model: 'gpt-4o-mini' }),
      node('r', 'router', { label: 'Router' }),
      node('o', 'output', { label: 'Out' }),
    ]
    const estimate = estimatePreRunCost(nodes, 'gpt-4o-mini')
    expect(estimate.count).toBe(2)
    expect(estimate.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('prefers a per-node modelOverride over the node model and the global model', () => {
    const cheap = [node('a', 'llm', { label: 'A', model: 'gpt-4o-mini' })]
    const expensive = [
      node('a', 'llm', { label: 'A', model: 'gpt-4o-mini', modelOverride: 'claude-opus-4-8' }),
    ]
    const cheapEstimate = estimatePreRunCost(cheap, 'gpt-4o-mini')
    const expensiveEstimate = estimatePreRunCost(expensive, 'gpt-4o-mini')
    expect(expensiveEstimate.estimatedCostUsd).toBeGreaterThan(cheapEstimate.estimatedCostUsd)
  })

  it('falls back to the global model when a node has no model of its own', () => {
    const nodes = [node('a', 'llm', { label: 'A' })]
    const cheap = estimatePreRunCost(nodes, 'gpt-4o-mini')
    const expensive = estimatePreRunCost(nodes, 'claude-opus-4-8')
    expect(expensive.estimatedCostUsd).toBeGreaterThan(cheap.estimatedCostUsd)
  })
})
