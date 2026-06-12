import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { AgentFlowNode, AgentFlowNodeData, AgentFlowNodeType } from '../types'
import { exportPython } from './codeExporter'

function node(
  id: string,
  type: AgentFlowNodeType,
  data: Partial<AgentFlowNodeData> & { label: string },
): AgentFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data }
}

function edge(source: string, target: string, label?: string): Edge {
  const e: Edge = { id: `${source}->${target}`, source, target }
  if (label !== undefined) e.label = label
  return e
}

describe('exportPython — memory node edge splicing', () => {
  const nodes = [
    node('s', 'start', { label: 'Start' }),
    node('a', 'llm', { label: 'Alpha' }),
    node('m', 'memory', { label: 'Memory' }),
    node('o', 'output', { label: 'Omega' }),
  ]
  const edges = [edge('s', 'a'), edge('a', 'm'), edge('m', 'o')]
  const code = exportPython(nodes, edges)

  it('reconnects A → Memory → B as A → B', () => {
    expect(code).toContain('builder.add_edge("alpha", "omega")')
  })

  it('does not emit the memory node as a graph node', () => {
    expect(code).not.toContain('add_node("memory"')
  })

  it('still emits the checkpointer for the memory node', () => {
    expect(code).toContain('checkpointer = MemorySaver()')
    expect(code).toContain('graph = builder.compile(checkpointer=checkpointer)')
  })

  it('keeps the path fully wired from START to END', () => {
    expect(code).toContain('builder.add_edge(START, "alpha")')
    expect(code).toContain('builder.add_edge("omega", END)')
  })
})

describe('exportPython — label escaping', () => {
  it('sanitizes quotes and backslashes in docstrings', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Evil """ label \\' }),
    ]
    const code = exportPython(nodes, [edge('s', 'a')])
    // The raw label would terminate the docstring; the sanitized form
    // replaces double quotes with single quotes and backslashes with slashes.
    expect(code).toContain("LLM node: Evil ''' label /.")
    expect(code).not.toContain('Evil """')
  })

  it('emits prompts as valid Python string literals', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', {
        label: 'LLM',
        systemPrompt: 'Say "hi"\nthen stop \\',
      }),
    ]
    const code = exportPython(nodes, [edge('s', 'a')])
    expect(code).toContain('system = "Say \\"hi\\"\\nthen stop \\\\"')
  })
})

describe('exportPython — tool invoke key', () => {
  it('uses the first parameter name from the input schema', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('t', 'tool', {
        label: 'Weather',
        toolName: 'get_weather',
        inputSchema: 'city: str, units: str',
      }),
    ]
    const code = exportPython(nodes, [edge('s', 't')])
    expect(code).toContain('def get_weather(city: str, units: str) -> str:')
    expect(code).toContain('get_weather.invoke({"city": str(last.content)})')
  })

  it('falls back to "query" when no schema is declared', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('t', 'tool', { label: 'Search', toolName: 'web_search' }),
    ]
    const code = exportPython(nodes, [edge('s', 't')])
    expect(code).toContain('def web_search(query: str) -> str:')
    expect(code).toContain('web_search.invoke({"query": str(last.content)})')
  })
})

describe('exportPython — condition routing default', () => {
  it('emits a router that defaults to the first outgoing target', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('c', 'condition', { label: 'Done?', branches: ['yes', 'no'] }),
      node('a', 'llm', { label: 'Worker' }),
      node('o', 'output', { label: 'Reply' }),
    ]
    const edges = [
      edge('s', 'c'),
      edge('c', 'a', 'no'),
      edge('c', 'o', 'yes'),
    ]
    const code = exportPython(nodes, edges)
    expect(code).toContain(
      'builder.add_conditional_edges("done", route_done, {"worker": "worker", "reply": "reply"})',
    )
    // Default return is the first outgoing target.
    expect(code).toContain('def route_done(state: State) -> str:')
    expect(code).toContain('    return "worker"')
  })

  it('routes to END when a condition has no outgoing edges', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('c', 'condition', { label: 'Lonely' }),
    ]
    const code = exportPython(nodes, [edge('s', 'c')])
    expect(code).toContain('add_node("lonely", lonely)')
    // Router stub defaults to END when there is nothing to route to.
    expect(code).toContain('    return "END"')
    expect(code).not.toContain('add_conditional_edges("lonely"')
  })
})
