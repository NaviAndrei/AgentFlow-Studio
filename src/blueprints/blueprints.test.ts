import { describe, expect, it } from 'vitest'
import { BLUEPRINTS } from './index'
import { validateGraph } from '../utils/validation'
import type { AgentFlowEdge, AgentFlowNode } from '../types'

describe('blueprint gallery', () => {
  const ids = BLUEPRINTS.map((b) => b.id)

  it('includes the new Slice 1/2 blueprints', () => {
    expect(ids).toContain('corrective-rag')
    expect(ids).toContain('plan-and-execute')
  })

  it('includes the Wave 1 blueprints', () => {
    expect(ids).toContain('adaptive-rag')
    expect(ids).toContain('agentic-rag')
    expect(ids).toContain('multi-agent-debate')
    expect(ids).toContain('reflexion-agent')
  })

  it('includes the Wave 2 Map blueprints', () => {
    expect(ids).toContain('map-reduce-summarization')
    expect(ids).toContain('storm-research')
  })

  it('includes the Code Executor blueprint', () => {
    expect(ids).toContain('self-correcting-codegen')
  })

  it('includes the Evaluator blueprint', () => {
    expect(ids).toContain('self-rag')
  })

  it('includes the Subgraph blueprint', () => {
    expect(ids).toContain('hierarchical-teams')
  })

  it('includes the Memory blueprint', () => {
    expect(ids).toContain('long-term-memory-chatbot')
  })

  it('includes the Deep Research Agent flagship', () => {
    expect(ids).toContain('deep-research-agent')
  })

  it('no longer ships the retired rag-memory blueprint', () => {
    expect(ids).not.toContain('rag-memory')
  })

  it('every blueprint parsed (none dropped by the schema validator)', () => {
    // 15 from Waves 0+1, plus Wave 2: Map(2) + CodeExec(1) + Evaluator(1) +
    // Subgraph(1) + Memory(1) + Flagship Deep Research Agent.
    expect(BLUEPRINTS.length).toBe(22)
  })

  it('the new blueprints have no validation errors', () => {
    for (const id of [
      'corrective-rag',
      'plan-and-execute',
      'adaptive-rag',
      'agentic-rag',
      'multi-agent-debate',
      'reflexion-agent',
      'map-reduce-summarization',
      'storm-research',
      'self-correcting-codegen',
      'self-rag',
      'hierarchical-teams',
      'long-term-memory-chatbot',
      'deep-research-agent',
    ]) {
      const bp = BLUEPRINTS.find((b) => b.id === id)
      expect(bp).toBeDefined()
      const nodes = bp!.nodes as unknown as AgentFlowNode[]
      const edges = bp!.edges as unknown as AgentFlowEdge[]
      const errors = validateGraph(nodes, edges).filter(
        (i) => i.level === 'error',
      )
      expect(errors).toEqual([])
    }
  })
})
