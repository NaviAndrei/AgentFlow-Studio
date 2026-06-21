import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { AgentFlowNode, AgentFlowNodeData, AgentFlowNodeType } from '../types'
import {
  exportPython,
  exportRequirements,
  pydanticFieldsFromSchema,
} from './codeExporter'
import { inferExportModel, resolveModelSetup } from './exportModels'

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

describe('resolveModelSetup — model family resolution', () => {
  it('maps legacy tier aliases to current Gemini ids', () => {
    const setup = resolveModelSetup('gemini-flash')
    expect(setup.pythonLine('m', 0.7)).toBe(
      'm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7)',
    )
    expect(setup.requirement).toBe('langchain-google-genai')
    expect(setup.envVar).toBe('GOOGLE_API_KEY')
  })

  it('strips the ollama/ prefix and needs no API key', () => {
    const setup = resolveModelSetup('ollama/llama3')
    expect(setup.pythonLine('m', 0)).toBe('m = ChatOllama(model="llama3", temperature=0)')
    expect(setup.requirement).toBe('langchain-ollama')
    expect(setup.envVar).toBeUndefined()
  })

  it('routes groq/ models through ChatOpenAI with the Groq base URL', () => {
    const setup = resolveModelSetup('groq/llama-3.3-70b-versatile')
    expect(setup.pythonLine('m', 0.7)).toContain('base_url="https://api.groq.com/openai/v1"')
    expect(setup.pythonLine('m', 0.7)).toContain('model="llama-3.3-70b-versatile"')
    expect(setup.requirement).toBe('langchain-openai')
    expect(setup.envVar).toBe('GROQ_API_KEY')
  })

  it('treats unknown ids as plain OpenAI models', () => {
    const setup = resolveModelSetup('gpt-4o-mini')
    expect(setup.pythonLine('m', 1)).toBe('m = ChatOpenAI(model="gpt-4o-mini", temperature=1)')
    expect(setup.envVar).toBe('OPENAI_API_KEY')
  })
})

describe('inferExportModel — model-source policy', () => {
  const llm = node('a', 'llm', { label: 'LLM', model: 'gpt-4o-mini' })
  const modelless = node('x', 'structuredOutput', { label: 'Shape' })

  it('prefers the node override', () => {
    const withOverride = node('x', 'structuredOutput', {
      label: 'Shape',
      modelOverride: 'gemini-2.5-pro',
    })
    expect(inferExportModel([llm, withOverride], withOverride)).toBe('gemini-2.5-pro')
  })

  it('falls back to the first LLM node on canvas', () => {
    expect(inferExportModel([llm, modelless], modelless)).toBe('gpt-4o-mini')
  })

  it('returns null when no model source exists', () => {
    expect(inferExportModel([modelless], modelless)).toBeNull()
  })
})

describe('exportPython — model setup emission', () => {
  it('emits imports, requirements, and env guards per model family', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Alpha', model: 'groq/llama-3.3-70b-versatile' }),
      node('b', 'llm', { label: 'Beta', model: 'ollama/mistral' }),
    ]
    const code = exportPython(nodes, [edge('s', 'a'), edge('a', 'b')])
    expect(code).toContain('from langchain_openai import ChatOpenAI')
    expect(code).toContain('from langchain_ollama import ChatOllama')
    expect(code).toContain('import os')
    expect(code).toContain('if not os.environ.get("GROQ_API_KEY"):')
    const reqs = exportRequirements(nodes)
    expect(reqs).toContain('langchain-openai')
    expect(reqs).toContain('langchain-ollama')
    expect(reqs).not.toContain('langchain-google-genai')
  })

  it('keeps legacy blueprint model ids exporting', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Gen', model: 'gemini-flash' }),
    ]
    const code = exportPython(nodes, [edge('s', 'a')])
    expect(code).toContain('ChatGoogleGenerativeAI(model="gemini-2.5-flash"')
    expect(code).toContain('if not os.environ.get("GOOGLE_API_KEY"):')
  })
})

describe('exportPython — router node', () => {
  const nodes = [
    node('s', 'start', { label: 'Start' }),
    node('a', 'llm', { label: 'Gen', model: 'gpt-4o-mini' }),
    node('r', 'router', {
      label: 'Triage',
      routes: ['billing', 'tech'],
      routingPrompt: 'Classify it.',
    }),
    node('b', 'llm', { label: 'Billing', model: 'gpt-4o-mini' }),
    node('t', 'llm', { label: 'Tech', model: 'gpt-4o-mini' }),
    node('o', 'output', { label: 'Done' }),
  ]
  const edges = [
    edge('s', 'a'),
    edge('a', 'r'),
    edge('r', 'b', 'billing'),
    edge('r', 't', 'tech'),
    edge('b', 'o'),
    edge('t', 'o'),
  ]
  const code = exportPython(nodes, edges)

  it('emits a real Literal classifier with no TODO in the route body', () => {
    expect(code).toContain('route: Literal["billing", "tech"]')
    expect(code).toContain('.with_structured_output(_Route).invoke(')
    // The route function maps route names to targets.
    expect(code).toContain('targets = {"billing": "billing", "tech": "tech"}')
    expect(code).toContain(
      'builder.add_conditional_edges("triage", route_triage,',
    )
  })

  it('does not leave a routing TODO when a model is available', () => {
    const routeBody = code.slice(code.indexOf('def route_triage'))
    expect(routeBody.slice(0, 400)).not.toContain('TODO')
  })

  it('falls back to a TODO route when no model exists on canvas', () => {
    const noModel = [
      node('s', 'start', { label: 'Start' }),
      node('r', 'router', { label: 'Triage', routes: ['a', 'b'] }),
      node('x', 'output', { label: 'A' }),
      node('y', 'output', { label: 'B' }),
    ]
    const c = exportPython(noModel, [
      edge('s', 'r'),
      edge('r', 'x', 'a'),
      edge('r', 'y', 'b'),
    ])
    expect(c).toContain('# TODO: no model on canvas')
  })
})

describe('exportPython — router derives routes from labeled edges (Task D Improvement 1)', () => {
  it('produces a real routing dict instead of the no-model placeholder when data.routes is empty but outgoing edges are labeled', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Gen', model: 'gpt-4o-mini' }),
      node('r', 'router', { label: 'Triage' }),
      node('b', 'llm', { label: 'Billing', model: 'gpt-4o-mini' }),
      node('t', 'llm', { label: 'Tech', model: 'gpt-4o-mini' }),
    ]
    const edges = [
      edge('s', 'a'),
      edge('a', 'r'),
      edge('r', 'b', 'billing'),
      edge('r', 't', 'tech'),
    ]
    const code = exportPython(nodes, edges)
    expect(code).not.toContain('# TODO: no model on canvas')
    expect(code).toContain('targets = {"billing": "billing", "tech": "tech"}')
    expect(code).toContain('builder.add_conditional_edges("triage", route_triage,')
  })

  it('keeps the existing placeholder when neither data.routes nor edge labels are present', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Gen', model: 'gpt-4o-mini' }),
      node('r', 'router', { label: 'Triage' }),
      node('b', 'llm', { label: 'Billing', model: 'gpt-4o-mini' }),
    ]
    const edges = [edge('s', 'a'), edge('a', 'r'), edge('r', 'b')]
    const code = exportPython(nodes, edges)
    expect(code).toContain('# TODO: no model on canvas')
  })
})

describe('exportPython — agent node ToolNode emission (Task D Improvement 2)', () => {
  it('emits a ToolNode for an agent with tools', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'agent', { label: 'Worker', tools: ['search', 'calc'] }),
    ]
    const code = exportPython(nodes, [edge('s', 'a')])
    expect(code).toContain('from langgraph.prebuilt import ToolNode')
    expect(code).toContain('tool_node = ToolNode(tools=[search, calc])')
  })

  it('does not emit ToolNode for an agent with no tools', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'agent', { label: 'Worker' }),
    ]
    const code = exportPython(nodes, [edge('s', 'a')])
    expect(code).not.toContain('ToolNode')
  })
})

describe('exportPython — START edge dedup (Task D Improvement 3)', () => {
  it('does not duplicate builder.add_edge(START, ...) when two Start nodes wire to the same target', () => {
    const nodes = [
      node('s1', 'start', { label: 'Start 1' }),
      node('s2', 'start', { label: 'Start 2' }),
      node('a', 'llm', { label: 'Gen', model: 'gpt-4o-mini' }),
    ]
    const edges = [edge('s1', 'a'), edge('s2', 'a')]
    const code = exportPython(nodes, edges)
    const matches = code.match(/builder\.add_edge\(START, "gen"\)/g) ?? []
    expect(matches).toHaveLength(1)
  })
})

describe('exportPython — generated file header (Task D Improvement 4)', () => {
  it('always prepends the AgentFlow Studio header comment', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('a', 'llm', { label: 'Gen', model: 'gpt-4o-mini' }),
    ]
    const code = exportPython(nodes, [edge('s', 'a')])
    expect(code).toContain('# Generated by AgentFlow Studio')
  })
})

describe('exportPython — guardrail node', () => {
  it('emits a real keyword check routing to pass/fail', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('g', 'guardrail', {
        label: 'Gate',
        checkType: 'keyword',
        criteria: 'refund, invoice',
      }),
      node('p', 'output', { label: 'Pass' }),
      node('f', 'llm', { label: 'Fail', model: 'gpt-4o-mini' }),
    ]
    const code = exportPython(nodes, [
      edge('s', 'g'),
      edge('g', 'p', 'pass'),
      edge('g', 'f', 'fail'),
    ])
    expect(code).toContain('terms = ["refund","invoice"]')
    expect(code).toContain(
      'return "pass" if any(t.lower() in content for t in terms) else "fail"',
    )
    // "Pass" output → ident "pass_node" (pass is a Python keyword); the
    // route_ function still returns the literal "pass"/"fail" labels.
    expect(code).toContain(
      'builder.add_conditional_edges("gate", route_gate, {"pass": "pass_node", "fail": "fail"})',
    )
  })
})

describe('exportPython — join node', () => {
  // Planner fans out to two workers, which converge on a concat Join.
  const nodes = [
    node('s', 'start', { label: 'Start' }),
    node('p', 'llm', { label: 'Planner', model: 'gpt-4o-mini' }),
    node('w1', 'llm', { label: 'Worker One', model: 'gpt-4o-mini' }),
    node('w2', 'llm', { label: 'Worker Two', model: 'gpt-4o-mini' }),
    node('j', 'join', { label: 'Gather', mergeStrategy: 'concat' }),
    node('o', 'output', { label: 'Done' }),
  ]
  const edges = [
    edge('s', 'p'),
    edge('p', 'w1'),
    edge('p', 'w2'),
    edge('w1', 'j'),
    edge('w2', 'j'),
    edge('j', 'o'),
  ]
  const code = exportPython(nodes, edges)

  it('adds the operator.add reducer for a concat join', () => {
    expect(code).toContain('import operator')
    expect(code).toContain('branch_results: Annotated[list, operator.add]')
  })

  it('fans out the planner to parallel edges, not a router', () => {
    expect(code).toContain('builder.add_edge("planner", "worker_one")')
    expect(code).toContain('builder.add_edge("planner", "worker_two")')
    expect(code).not.toContain('def route_planner')
  })

  it('wires both workers into the join and the join onward', () => {
    expect(code).toContain('builder.add_edge("worker_one", "gather")')
    expect(code).toContain('builder.add_edge("worker_two", "gather")')
    expect(code).toContain('builder.add_edge("gather", "done")')
    expect(code).toContain('def gather(state: State) -> dict:')
  })

  it('omits the reducer when the only join uses the last strategy', () => {
    const lastNodes = nodes.map((n) =>
      n.id === 'j' ? node('j', 'join', { label: 'Gather', mergeStrategy: 'last' }) : n,
    )
    const c = exportPython(lastNodes, edges)
    expect(c).not.toContain('import operator')
    expect(c).not.toContain('branch_results')
  })
})

describe('exportPython — subgraph node', () => {
  const nodes = [
    node('s', 'start', { label: 'Start' }),
    node('sg', 'subgraph', {
      label: 'Research Team',
      subgraphRef: 'research-team',
      inputMapping: '{"brief": "topic"}',
      outputMapping: '{"output": "report"}',
    }),
    node('o', 'output', { label: 'Done' }),
  ]
  const edges = [edge('s', 'sg'), edge('sg', 'o')]
  const code = exportPython(nodes, edges)

  it('compiles the inner graph and registers the wrapper, not the raw graph', () => {
    expect(code).toContain('research_team_inner = build_research_team_subgraph()')
    expect(code).toContain('def research_team(state: State) -> dict:')
    expect(code).toContain('builder.add_node("research_team", research_team)')
  })

  it('emits input and output remapping from the mapping JSON', () => {
    expect(code).toContain('inner_input["topic"] = state.get("brief")  # inputMapping')
    expect(code).toContain('result = research_team_inner.invoke(inner_input)')
    expect(code).toContain('if "output" in result:')
    expect(code).toContain('update["report"] = result["output"]  # outputMapping')
  })

  it('falls back to a messages-only passthrough when no mappings are set', () => {
    const plain = [
      node('s', 'start', { label: 'Start' }),
      node('sg', 'subgraph', { label: 'Sub', subgraphRef: 'sub' }),
      node('o', 'output', { label: 'Done' }),
    ]
    const c = exportPython(plain, [edge('s', 'sg'), edge('sg', 'o')])
    expect(c).toContain('def sub(state: State) -> dict:')
    expect(c).toContain('return {"messages": result.get("messages", [])}')
    expect(c).not.toContain('# inputMapping')
  })

  it('uses ainvoke in async mode', () => {
    const c = exportPython(nodes, edges, { asyncMode: true })
    expect(c).toContain('async def research_team(state: State) -> dict:')
    expect(c).toContain('result = await research_team_inner.ainvoke(inner_input)')
  })
})

describe('pydanticFieldsFromSchema', () => {
  it('maps JSON-schema types and respects required vs optional', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        answer: { type: 'string' },
        score: { type: 'number' },
        count: { type: 'integer' },
        done: { type: 'boolean' },
      },
      required: ['answer', 'score'],
    })
    expect(pydanticFieldsFromSchema(schema)).toEqual([
      { name: 'answer', type: 'str', optional: false },
      { name: 'score', type: 'float', optional: false },
      { name: 'count', type: 'int', optional: true },
      { name: 'done', type: 'bool', optional: true },
    ])
  })

  it('returns null for unparseable JSON', () => {
    expect(pydanticFieldsFromSchema('{not json')).toBeNull()
  })

  it('returns null when there are no properties', () => {
    expect(pydanticFieldsFromSchema('{"type":"object"}')).toBeNull()
  })
})

describe('exportPython — structured output node', () => {
  const schema = JSON.stringify({
    type: 'object',
    properties: {
      sentiment: { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['sentiment'],
  })

  it('emits real Pydantic fields and a with_structured_output invoke', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('l', 'llm', { label: 'Analyze', model: 'gpt-4o-mini' }),
      node('o', 'structuredOutput', {
        label: 'Shape',
        pydanticModel: 'Analysis',
        jsonSchema: schema,
      }),
    ]
    const code = exportPython(nodes, [edge('s', 'l'), edge('l', 'o')])
    expect(code).toContain('from typing import Annotated, TypedDict, Optional')
    expect(code).toContain('class Analysis(BaseModel):')
    expect(code).toContain('    sentiment: str')
    expect(code).toContain('    confidence: Optional[float] = None')
    expect(code).toContain(
      '.with_structured_output(Analysis).invoke(state["messages"])',
    )
    expect(code).toContain('result.model_dump_json()')
  })

  it('falls back to answer: str on an unparseable schema', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('l', 'llm', { label: 'Analyze', model: 'gpt-4o-mini' }),
      node('o', 'structuredOutput', {
        label: 'Shape',
        pydanticModel: 'Analysis',
        jsonSchema: '{broken',
      }),
    ]
    const code = exportPython(nodes, [edge('s', 'l'), edge('l', 'o')])
    expect(code).toContain('class Analysis(BaseModel):')
    expect(code).toContain('    answer: str')
  })

  it('emits a TODO when no model is available for the structured call', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('o', 'structuredOutput', {
        label: 'Shape',
        pydanticModel: 'Analysis',
        jsonSchema: schema,
      }),
    ]
    const code = exportPython(nodes, [edge('s', 'o')])
    expect(code).toContain('# TODO: no model on canvas')
  })
})

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

describe('exportPython — memory type drives the checkpointer', () => {
  it('does not emit a checkpointer for a vector-store memory', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('r', 'retriever', { label: 'Retriever' }),
      node('m', 'memory', { label: 'Docs', memoryType: 'vector-store' }),
      node('o', 'output', { label: 'Out' }),
    ]
    const edges = [edge('s', 'r'), edge('r', 'o'), edge('m', 'r', 'index')]
    const code = exportPython(nodes, edges)
    expect(code).not.toContain('MemorySaver')
    expect(code).not.toContain('checkpointer=checkpointer')
    expect(code).toContain('# Vector store "Docs"')
  })

  it('emits a checkpointer for a checkpointer memory', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('l', 'llm', { label: 'Gen', model: 'gpt-4o-mini' }),
      node('m', 'memory', { label: 'History', memoryType: 'checkpointer' }),
      node('o', 'output', { label: 'Out' }),
    ]
    const edges = [edge('s', 'l'), edge('l', 'm'), edge('m', 'o')]
    const code = exportPython(nodes, edges)
    expect(code).toContain('checkpointer = MemorySaver()')
    expect(code).toContain('graph = builder.compile(checkpointer=checkpointer)')
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

describe('exportPython — httpRequest', () => {
  it('emits a sync GET request with httpx', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('h', 'httpRequest', {
        label: 'Fetch',
        httpUrl: 'https://api.example.com/data',
        httpMethod: 'GET',
      }),
    ]
    const code = exportPython(nodes, [edge('s', 'h')])
    expect(code).toContain('import httpx')
    expect(code).toContain('resp = httpx.get(')
    expect(code).toContain('"https://api.example.com/data"')
    expect(code).toContain('resp.raise_for_status()')
  })

  it('emits an async POST request with headers and body in async mode', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('h', 'httpRequest', {
        label: 'Send',
        httpUrl: 'https://api.example.com/submit',
        httpMethod: 'POST',
        httpHeaders: '{"Content-Type": "application/json"}',
        httpBody: '{"key": "value"}',
      }),
    ]
    const code = exportPython(nodes, [edge('s', 'h')], { asyncMode: true })
    expect(code).toContain('async def send(state: State) -> dict:')
    expect(code).toContain('async with httpx.AsyncClient(')
    expect(code).toContain('await client.post(')
    expect(code).toContain('headers={"Content-Type": "application/json"},')
    expect(code).toContain('content="{\\"key\\": \\"value\\"}",')
  })
})

describe('exportPython — codeExecutor', () => {
  it('emits a stubbed sandbox call with a TODO for the configured language', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('c', 'codeExecutor', { label: 'Run', language: 'python', timeout: 15 }),
    ]
    const code = exportPython(nodes, [edge('s', 'c')])
    expect(code).toContain('def run(state: State) -> dict:')
    expect(code).toContain('(python, timeout=15s)')
    expect(code).toContain('PythonREPL')
  })
})

describe('exportPython — loop', () => {
  it('emits a stub documenting the configured loop condition', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('l', 'loop', { label: 'Retry until done', loopCondition: 'count < 3' }),
    ]
    const code = exportPython(nodes, [edge('s', 'l')])
    expect(code).toContain('def retry_until_done(state: State) -> dict:')
    expect(code).toContain('iterate until: count < 3')
  })
})

describe('exportPython — tryCatch', () => {
  it('emits try/except routing with onSuccess/onError edges', () => {
    const nodes = [
      node('s', 'start', { label: 'Start' }),
      node('t', 'tryCatch', {
        label: 'Guard',
        tryCatch: { catchErrors: ['any'], fallbackOutput: 'fallback reply' },
      }),
      node('ok', 'output', { label: 'OK' }),
      node('err', 'output', { label: 'Err' }),
    ]
    const edges = [
      edge('s', 't'),
      edge('t', 'ok', 'onSuccess'),
      edge('t', 'err', 'onError'),
    ]
    const code = exportPython(nodes, edges)
    expect(code).toContain('def guard(state: State) -> dict:')
    expect(code).toContain('except Exception as e:')
    expect(code).toContain('"trycatch_guard_result": "error"')
    expect(code).toContain('fallback reply')
    expect(code).toContain('def route_guard(state: State) -> str:')
    expect(code).toContain(
      'builder.add_conditional_edges("guard", route_guard, {"success": "ok", "error": "err"})',
    )
  })
})
