import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { AgentFlowNode, AgentFlowNodeData, AgentFlowNodeType } from '../types'
import { validateGraph } from './validation'

function node(
  id: string,
  type: AgentFlowNodeType,
  data: Partial<AgentFlowNodeData> = {},
): AgentFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } }
}

function edge(source: string, target: string, label?: string): Edge {
  const e: Edge = { id: `${source}->${target}`, source, target }
  if (label !== undefined) e.label = label
  return e
}

const messages = (nodes: AgentFlowNode[], edges: Edge[]) =>
  validateGraph(nodes, edges).map((i) => i.message)

describe('validateGraph — additive rules', () => {
  it('passes a clean linear graph with no warnings', () => {
    const nodes = [
      node('s', 'start'),
      node('l', 'llm', { model: 'gemini-2.5-flash' }),
      node('o', 'output'),
    ]
    const edges = [edge('s', 'l'), edge('l', 'o')]
    expect(validateGraph(nodes, edges)).toEqual([])
  })

  it('warns when the canvas has no Output node', () => {
    const nodes = [node('s', 'start'), node('l', 'llm', { model: 'm' })]
    const edges = [edge('s', 'l')]
    expect(messages(nodes, edges)).toContain('Canvas has no Output node')
  })

  it('warns when a supervisor has no outgoing edges', () => {
    const nodes = [
      node('s', 'start'),
      node('sup', 'supervisor'),
      node('o', 'output'),
    ]
    // Supervisor is reachable but routes nowhere.
    const edges = [edge('s', 'sup'), edge('s', 'o')]
    expect(messages(nodes, edges)).toContain('Supervisor has no worker edges')
  })

  it('warns when vector-store memory does not feed a Retriever', () => {
    const nodes = [
      node('s', 'start'),
      node('m', 'memory', { memoryType: 'vector-store' }),
      node('l', 'llm', { model: 'm' }),
      node('o', 'output'),
    ]
    const edges = [edge('s', 'l'), edge('l', 'o'), edge('m', 'l', 'index')]
    expect(messages(nodes, edges)).toContain(
      'Vector-store memory is not connected to a Retriever',
    )
  })

  it('does not warn when vector-store memory feeds a Retriever', () => {
    const nodes = [
      node('s', 'start'),
      node('m', 'memory', { memoryType: 'vector-store' }),
      node('r', 'retriever'),
      node('o', 'output'),
    ]
    const edges = [edge('s', 'r'), edge('r', 'o'), edge('m', 'r', 'index')]
    expect(messages(nodes, edges)).not.toContain(
      'Vector-store memory is not connected to a Retriever',
    )
  })

  it('warns when a wired node is unreachable from Start', () => {
    const nodes = [
      node('s', 'start'),
      node('l', 'llm', { model: 'm' }),
      node('o', 'output'),
      // island pair: wired to each other but not to the Start path
      node('x', 'llm', { model: 'm' }),
      node('y', 'output'),
    ]
    const edges = [edge('s', 'l'), edge('l', 'o'), edge('x', 'y')]
    expect(messages(nodes, edges)).toContain(
      'Node is not reachable from a Start node',
    )
  })

  it('errors when a router has fewer than two routes', () => {
    const nodes = [
      node('s', 'start'),
      node('r', 'router', { routes: ['only'] }),
      node('a', 'output'),
    ]
    const edges = [edge('s', 'r'), edge('r', 'a', 'only')]
    expect(messages(nodes, edges)).toContain('Router needs at least two routes')
  })

  it('errors when a route has no matching outgoing edge', () => {
    const nodes = [
      node('s', 'start'),
      node('r', 'router', { routes: ['billing', 'tech'] }),
      node('a', 'output'),
      node('b', 'output'),
    ]
    // Only "billing" is wired; "tech" has no edge.
    const edges = [edge('s', 'r'), edge('r', 'a', 'billing'), edge('r', 'b', 'other')]
    expect(messages(nodes, edges)).toContain('Route "tech" has no outgoing edge')
  })

  it('errors when a guardrail is missing a pass or fail edge', () => {
    const nodes = [
      node('s', 'start'),
      node('g', 'guardrail'),
      node('p', 'output'),
    ]
    const edges = [edge('s', 'g'), edge('g', 'p', 'pass')]
    expect(messages(nodes, edges)).toContain('Guardrail is missing its "fail" edge')
  })

  it('warns when a condition branch has no matching outgoing edge', () => {
    const nodes = [
      node('s', 'start'),
      node('c', 'condition', { branches: ['retry', 'approve'] }),
      node('a', 'llm', { model: 'm' }),
      node('b', 'output'),
    ]
    // Edges labeled retry/done — "approve" has no matching edge.
    const edges = [
      edge('s', 'c'),
      edge('c', 'a', 'retry'),
      edge('c', 'b', 'done'),
    ]
    expect(messages(nodes, edges)).toContain(
      'Branch "approve" has no matching outgoing edge',
    )
  })

  it('warns when a join has fewer than two incoming branches', () => {
    const nodes = [
      node('s', 'start'),
      node('j', 'join'),
      node('o', 'output'),
    ]
    const edges = [edge('s', 'j'), edge('j', 'o')]
    expect(messages(nodes, edges)).toContain(
      'Join has fewer than two incoming branches',
    )
  })

  it('does not flag reachability when there is no Start node', () => {
    const nodes = [node('l', 'llm', { model: 'm' }), node('o', 'output')]
    const edges = [edge('l', 'o')]
    expect(messages(nodes, edges)).not.toContain(
      'Node is not reachable from a Start node',
    )
  })
})
