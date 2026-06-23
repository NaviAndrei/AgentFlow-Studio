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

describe('validateGraph — HTTP Request node', () => {
  it('errors when URL is empty', () => {
    const nodes = [node('h', 'httpRequest', { httpUrl: '' })]
    expect(messages(nodes, [])).toContain('HTTP Request: URL is required')
  })

  it('errors when URL has no http/https scheme', () => {
    const nodes = [node('h', 'httpRequest', { httpUrl: 'ftp://example.com' })]
    expect(messages(nodes, [])).toContain(
      'HTTP Request: URL must start with http:// or https://',
    )
  })

  it('does not flag a valid http URL', () => {
    const nodes = [
      node('h', 'httpRequest', { httpUrl: 'http://api.example.com/data' }),
    ]
    expect(messages(nodes, [])).not.toContain('HTTP Request: URL is required')
    expect(messages(nodes, [])).not.toContain(
      'HTTP Request: URL must start with http:// or https://',
    )
  })

  it('does not flag a valid https URL', () => {
    const nodes = [
      node('h', 'httpRequest', { httpUrl: 'https://api.example.com/data' }),
    ]
    expect(messages(nodes, [])).not.toContain('HTTP Request: URL is required')
  })

  it('warns when body is set on a GET request', () => {
    const nodes = [
      node('h', 'httpRequest', {
        httpUrl: 'https://api.example.com',
        httpMethod: 'GET',
        httpBody: '{"key":"value"}',
      }),
    ]
    expect(messages(nodes, [])).toContain(
      'HTTP Request: body is ignored for GET/DELETE requests',
    )
  })

  it('warns when body is set on a DELETE request', () => {
    const nodes = [
      node('h', 'httpRequest', {
        httpUrl: 'https://api.example.com/item/1',
        httpMethod: 'DELETE',
        httpBody: '{"confirm":true}',
      }),
    ]
    expect(messages(nodes, [])).toContain(
      'HTTP Request: body is ignored for GET/DELETE requests',
    )
  })

  it('does not warn when body is set on a POST request', () => {
    const nodes = [
      node('h', 'httpRequest', {
        httpUrl: 'https://api.example.com/items',
        httpMethod: 'POST',
        httpBody: '{"name":"test"}',
      }),
    ]
    expect(messages(nodes, [])).not.toContain(
      'HTTP Request: body is ignored for GET/DELETE requests',
    )
  })

  it('warns on an unguarded cycle made only of agent nodes', () => {
    const nodes = [node('A', 'agent'), node('B', 'agent'), node('C', 'agent')]
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')]
    const cycleMessages = messages(nodes, edges).filter((m) =>
      m.includes('Unguarded cycle'),
    )
    expect(cycleMessages).toHaveLength(1)
    expect(cycleMessages[0]).toContain('Unguarded cycle')
  })

  it('does not warn on a cycle guarded by a router node', () => {
    const nodes = [node('A', 'agent'), node('B', 'router'), node('C', 'agent')]
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')]
    const cycleMessages = messages(nodes, edges).filter((m) =>
      m.includes('Unguarded cycle'),
    )
    expect(cycleMessages).toHaveLength(0)
  })

  it('does not warn on the corrective-rag retriever→guardrail→router→llm loop', () => {
    const nodes = [
      node('retriever-1', 'retriever'),
      node('guardrail-1', 'guardrail'),
      node('router-1', 'router'),
      node('llm-2', 'llm', { model: 'gemini-2.5-flash' }),
    ]
    const edges = [
      edge('retriever-1', 'guardrail-1'),
      edge('guardrail-1', 'router-1', 'fail'),
      edge('router-1', 'llm-2', 'rewrite'),
      edge('llm-2', 'retriever-1', 'retry'),
    ]
    const cycleMessages = messages(nodes, edges).filter((m) =>
      m.includes('Unguarded cycle'),
    )
    expect(cycleMessages).toHaveLength(0)
  })

  it('warns on a self-loop on a pure agent node', () => {
    const nodes = [node('A', 'agent')]
    const edges = [edge('A', 'A')]
    const cycleMessages = messages(nodes, edges).filter((m) =>
      m.includes('Unguarded cycle'),
    )
    expect(cycleMessages).toHaveLength(1)
  })

  it('does not warn on a linear chain with no cycle', () => {
    const nodes = [node('A', 'agent'), node('B', 'agent'), node('C', 'agent')]
    const edges = [edge('A', 'B'), edge('B', 'C')]
    const cycleMessages = messages(nodes, edges).filter((m) =>
      m.includes('Unguarded cycle'),
    )
    expect(cycleMessages).toHaveLength(0)
  })
})
