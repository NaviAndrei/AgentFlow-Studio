import type { AgentFlowEdge, AgentFlowNode, AgentFlowNodeType, LLMModel } from '../types'
import { topologicalSort } from './topologicalSort'

export interface ExportOptions {
  /** Emit `async def` node functions and an async invoke example. */
  asyncMode: boolean
}

// UI "flash"/"pro" are capability tiers mapped to the current concrete
// Gemini model ids (2.5 GA line).
const MODEL_SETUP: Record<LLMModel, (varName: string, temp: number) => string> = {
  'gemini-flash': (v, t) =>
    `${v} = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=${t})`,
  'gemini-pro': (v, t) =>
    `${v} = ChatGoogleGenerativeAI(model="gemini-2.5-pro", temperature=${t})`,
  'ollama/llama3': (v, t) => `${v} = ChatOllama(model="llama3", temperature=${t})`,
  'ollama/mistral': (v, t) => `${v} = ChatOllama(model="mistral", temperature=${t})`,
}

/** Node types that become graph nodes (memory and notes are handled separately). */
const GRAPH_NODE_TYPES: AgentFlowNodeType[] = [
  'llm',
  'agent',
  'tool',
  'output',
  'condition',
  'loop',
  'humanInLoop',
  'supervisor',
  'swarmWorker',
  'retriever',
  'mcpServer',
  'structuredOutput',
]

const PYTHON_KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
  'raise', 'return', 'try', 'while', 'with', 'yield',
  'False', 'None', 'True', 'match', 'case',
])

function pyIdent(label: string, used: Set<string>): string {
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (base.length === 0) base = 'node'
  if (/^[0-9]/.test(base)) base = `n_${base}`
  if (PYTHON_KEYWORDS.has(base)) base = `${base}_node`
  let name = base
  let suffix = 2
  while (used.has(name)) {
    name = `${base}_${suffix}`
    suffix += 1
  }
  used.add(name)
  return name
}

/** JSON string literals are valid Python string literals. */
function pyStr(value: string): string {
  return JSON.stringify(value)
}

/**
 * Sanitize free text for interpolation inside a triple-quoted docstring:
 * double quotes could form a closing `"""` and a trailing backslash would
 * escape it, so both are replaced.
 */
function pyDoc(value: string): string {
  return value.replace(/\\/g, '/').replace(/"/g, "'")
}

/**
 * Remove the given nodes from the edge list, reconnecting each incoming
 * source to each outgoing target so flow continuity is preserved (e.g.
 * `A → Memory → B` becomes `A → B`). Labels of the incoming edge survive.
 */
function spliceOutNodes(edges: AgentFlowEdge[], removeIds: string[]): AgentFlowEdge[] {
  let result = [...edges]
  for (const id of removeIds) {
    const incoming = result.filter((e) => e.target === id)
    const outgoing = result.filter((e) => e.source === id)
    result = result.filter((e) => e.source !== id && e.target !== id)
    for (const inn of incoming) {
      for (const out of outgoing) {
        result.push({ ...inn, id: `${inn.id}->${out.id}`, target: out.target })
      }
    }
  }
  // Drop duplicate source→target pairs splicing may have produced.
  const seen = new Set<string>()
  return result.filter((e) => {
    const key = `${e.source}->${e.target}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** All graph-node ids reachable from `start` by following wired edges. */
function reachableFrom(start: string, edges: AgentFlowEdge[], graphIds: Set<string>): Set<string> {
  const visited = new Set<string>()
  const stack = [start]
  while (stack.length > 0) {
    const cur = stack.pop()
    if (cur === undefined || visited.has(cur)) continue
    visited.add(cur)
    for (const e of edges) {
      if (e.source === cur && graphIds.has(e.target) && !visited.has(e.target)) {
        stack.push(e.target)
      }
    }
  }
  return visited
}

/**
 * Pick the first target that does not loop back to `fromId`, so generated
 * routers default to a terminal branch rather than silently looping forever.
 */
function pickDefaultTarget(
  fromId: string,
  targetIds: string[],
  edges: AgentFlowEdge[],
  graphIds: Set<string>,
): string | undefined {
  return targetIds.find((t) => !reachableFrom(t, edges, graphIds).has(fromId))
}

/** PascalCase Python class name from a free-text model name. */
function pyClassName(name: string, used: Set<string>): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  let base = cleaned
    ? cleaned
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')
    : 'OutputModel'
  if (/^[0-9]/.test(base)) base = `M${base}`
  let result = base
  let suffix = 2
  while (used.has(result)) {
    result = `${base}${suffix}`
    suffix += 1
  }
  used.add(result)
  return result
}

/** State fields declared on Start nodes (sanitized, deduped, sans messages). */
function stateFields(nodes: AgentFlowNode[]): string[] {
  const used = new Set<string>(['messages'])
  return nodes
    .filter((n) => n.type === 'start')
    .flatMap((n) => n.data.inputVariables ?? [])
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => pyIdent(v, used))
}

export function exportRequirements(nodes: AgentFlowNode[]): string {
  const hasGemini = nodes.some(
    (n) => n.type === 'llm' && (n.data.model ?? 'gemini-flash').startsWith('gemini'),
  )
  const hasOllama = nodes.some(
    (n) => n.type === 'llm' && (n.data.model ?? '').startsWith('ollama'),
  )
  const lines = ['langgraph']
  if (hasGemini) lines.push('langchain-google-genai')
  if (hasOllama) lines.push('langchain-ollama')
  if (nodes.some((n) => n.type === 'structuredOutput')) lines.push('pydantic')
  if (nodes.some((n) => n.type === 'mcpServer')) {
    lines.push('langchain-mcp-adapters')
  }
  lines.push('python-dotenv')
  return lines.join('\n') + '\n'
}

export function exportPython(
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
  options: ExportOptions = { asyncMode: false },
): string {
  const graphNodes = nodes.filter(
    (n) => n.type && GRAPH_NODE_TYPES.includes(n.type),
  )
  const startNodes = nodes.filter((n) => n.type === 'start')
  const memoryNodes = nodes.filter((n) => n.type === 'memory')

  if (graphNodes.length === 0 && startNodes.length === 0) {
    return '# Empty canvas — add some nodes before exporting.\n'
  }

  const defKeyword = options.asyncMode ? 'async def' : 'def'
  const invoke = (target: string, args: string) =>
    options.asyncMode ? `await ${target}.ainvoke(${args})` : `${target}.invoke(${args})`

  const used = new Set<string>()
  const names = new Map<string, string>()
  for (const node of [...startNodes, ...graphNodes]) {
    names.set(node.id, pyIdent(node.data.label, used))
  }

  // Memory nodes become a checkpointer, not graph nodes — splice them out
  // of the edge list so paths running through them stay connected.
  const wiredEdges = spliceOutNodes(
    edges,
    memoryNodes.map((n) => n.id),
  )

  const graphIds = new Set(graphNodes.map((n) => n.id))
  const order = topologicalSort(
    graphNodes.map((n) => n.id),
    wiredEdges.filter((e) => graphIds.has(e.source) && graphIds.has(e.target)),
  )
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const orderedNodes = order
    .map((id) => byId.get(id))
    .filter((n): n is AgentFlowNode => n !== undefined)

  const outgoing = (id: string) =>
    wiredEdges.filter((e) => e.source === id && graphIds.has(e.target))

  const hasGemini = nodes.some(
    (n) => n.type === 'llm' && (n.data.model ?? 'gemini-flash').startsWith('gemini'),
  )
  const hasOllama = nodes.some(
    (n) => n.type === 'llm' && (n.data.model ?? '').startsWith('ollama'),
  )
  const hasTools = nodes.some((n) => n.type === 'tool')
  const hasMemory = memoryNodes.length > 0
  const hilNames = graphNodes
    .filter((n) => n.type === 'humanInLoop')
    .map((n) => names.get(n.id))
    .filter((n): n is string => n !== undefined)
  const fields = stateFields(nodes)

  const lines: string[] = []
  const emit = (...added: string[]) => lines.push(...added)

  emit('"""Generated by AgentFlow Studio."""', '')
  if (options.asyncMode) emit('import asyncio')
  if (hasGemini) emit('import os')
  emit('from typing import Annotated, TypedDict')
  emit('')
  const structuredNodes = graphNodes.filter(
    (n) => n.type === 'structuredOutput',
  )
  emit('from langgraph.graph import StateGraph, START, END')
  emit('from langgraph.graph.message import add_messages')
  if (structuredNodes.length > 0) emit('from pydantic import BaseModel')
  if (hasMemory) emit('from langgraph.checkpoint.memory import MemorySaver')
  if (hasGemini) emit('from langchain_google_genai import ChatGoogleGenerativeAI')
  if (hasOllama) emit('from langchain_ollama import ChatOllama')
  if (hasTools) emit('from langchain_core.tools import tool')
  emit('')

  // --- State ---
  emit('# --- State ---')
  emit('class State(TypedDict):')
  emit('    messages: Annotated[list, add_messages]')
  for (const field of fields) {
    emit(`    ${field}: str`)
  }
  emit('')

  // --- Structured output models ---
  const usedClassNames = new Set<string>()
  const structuredClassNames = new Map<string, string>()
  if (structuredNodes.length > 0) {
    emit('# --- Structured output models ---')
    for (const node of structuredNodes) {
      const className = pyClassName(
        node.data.pydanticModel ?? 'OutputModel',
        usedClassNames,
      )
      structuredClassNames.set(node.id, className)
      const schema = (node.data.jsonSchema ?? '').trim().replace(/\s+/g, ' ')
      emit(`class ${className}(BaseModel):`)
      emit('    """TODO: derive fields from the JSON schema below."""')
      emit(`    # schema: ${schema.slice(0, 160)}`)
      emit('    answer: str')
      emit('')
    }
  }

  // --- Models ---
  const llmNodes = orderedNodes.filter((n) => n.type === 'llm')
  if (llmNodes.length > 0) {
    emit('# --- Models ---')
    for (const node of llmNodes) {
      const model = node.data.model ?? 'gemini-flash'
      const temp = node.data.temperature ?? 0.7
      emit(MODEL_SETUP[model](`${names.get(node.id)}_model`, temp))
    }
    emit('')
  }

  // --- Tools ---
  const toolNodes = orderedNodes.filter((n) => n.type === 'tool')
  const toolFnNames = new Map<string, string>()
  if (toolNodes.length > 0) {
    emit('# --- Tools ---')
    for (const node of toolNodes) {
      const toolName = pyIdent(node.data.toolName ?? 'my_tool', used)
      toolFnNames.set(node.id, toolName)
      const input = node.data.inputSchema?.trim() || 'query: str'
      emit(
        '@tool',
        `def ${toolName}(${input}) -> str:`,
        `    ${pyStr(node.data.description ?? 'TODO: describe this tool.')}`,
        `    raise NotImplementedError("Implement ${toolName}")`,
        '',
      )
    }
  }

  // --- Node functions ---
  emit('# --- Nodes ---')
  for (const node of orderedNodes) {
    const name = names.get(node.id)
    if (!name) continue
    switch (node.type) {
      case 'llm': {
        const prompt = node.data.systemPrompt ?? 'You are a helpful assistant.'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """LLM node: ${pyDoc(node.data.label)}."""`,
          `    system = ${pyStr(prompt)}`,
          `    response = ${invoke(
            `${name}_model`,
            '\n        [{"role": "system", "content": system}, *state["messages"]]\n    ',
          )}`,
          '    return {"messages": [response]}',
          '',
        )
        break
      }
      case 'agent': {
        const tools = (node.data.tools ?? []).filter(Boolean)
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Agent node: ${pyDoc(node.data.label)} (tools: ${pyDoc(JSON.stringify(tools))}, max ${node.data.maxIterations ?? 10} iterations)."""`,
          '    # TODO: implement the agent loop, e.g. with langgraph.prebuilt:',
          '    #   from langgraph.prebuilt import create_react_agent',
          '    #   agent = create_react_agent(model, tools=[...])',
          `    return {"messages": [{"role": "assistant", "content": ${pyStr(`${node.data.label}: not implemented`)}}]}`,
          '',
        )
        break
      }
      case 'tool': {
        const toolName = toolFnNames.get(node.id) ?? 'my_tool'
        // Invoke with the first parameter name declared in the input schema
        // so the call matches the generated @tool signature.
        const argName =
          (node.data.inputSchema ?? '').match(/^\s*(\w+)/)?.[1] ?? 'query'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Tool node: ${pyDoc(node.data.label)}."""`,
          '    last = state["messages"][-1]',
          `    result = ${invoke(toolName, `{"${argName}": str(last.content)}`)}`,
          `    return {"messages": [{"role": "user", "content": f"[${toolName} result] {result}"}]}`,
          '',
        )
        break
      }
      case 'output': {
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Output node: ${pyDoc(node.data.label)} — final reply."""`,
          '    return {}',
          '',
        )
        break
      }
      case 'condition': {
        const branches = (node.data.branches ?? []).filter(Boolean)
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Condition node: ${pyDoc(node.data.label)}."""`,
          '    return {}',
          '',
        )
        const outs = outgoing(node.id)
        const targets = outs.map((e) => names.get(e.target)).filter(Boolean)
        const defaultTargetId = pickDefaultTarget(
          node.id,
          outs.map((e) => e.target),
          wiredEdges,
          graphIds,
        )
        const defaultTarget = defaultTargetId ? names.get(defaultTargetId) : undefined
        emit(
          `def route_${name}(state: State) -> str:`,
          `    """Routing for condition '${pyDoc(node.data.label)}'."""`,
          `    # TODO: implement branching — branches: ${JSON.stringify(branches)}`,
          ...targets.map((t, i) => `    # ${i === 0 ? 'if   …' : 'else …'} return "${t}"`),
          `    return "${defaultTarget ?? 'END'}"`,
          '',
        )
        break
      }
      case 'loop': {
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Loop node: ${pyDoc(node.data.label)} — iterate until: ${pyDoc(node.data.loopCondition ?? '')}."""`,
          '    return {}',
          '',
        )
        break
      }
      case 'humanInLoop': {
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Human-in-the-loop gate: ${pyDoc(node.data.label)}."""`,
          '    # Execution pauses before this node (see interrupt_before in compile()).',
          '    return {}',
          '',
        )
        break
      }
      case 'supervisor': {
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Supervisor node: ${pyDoc(node.data.label)} — routes tasks to workers."""`,
          '    # TODO: call an LLM to decide which worker should act next',
          '    return {}',
          '',
        )
        break
      }
      case 'swarmWorker': {
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Swarm worker: ${pyDoc(node.data.label)} — peer agent with handoffs."""`,
          '    # TODO: implement worker; hand off with Command(goto="peer") in real code',
          `    return {"messages": [{"role": "assistant", "content": ${pyStr(`${node.data.label}: not implemented`)}}]}`,
          '',
        )
        break
      }
      case 'retriever': {
        const k = node.data.topK ?? 4
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Retriever node: ${pyDoc(node.data.label)} (kb: ${pyDoc(node.data.knowledgeBase ?? 'docs')}, top_k=${k}, threshold=${node.data.similarityThreshold ?? 0.75})."""`,
          '    # TODO: wire a real vector store, e.g.:',
          `    #   docs = vector_store.similarity_search(str(state["messages"][-1].content), k=${k})`,
          '    return {"messages": [{"role": "user", "content": "[retrieved context] TODO"}]}',
          '',
        )
        break
      }
      case 'mcpServer': {
        const tools = (node.data.mcpTools ?? []).filter(Boolean)
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """MCP server node: ${pyDoc(node.data.label)} (${pyDoc(node.data.serverUrl ?? '')}) — tools: ${pyDoc(JSON.stringify(tools))}."""`,
          '    # TODO: connect via langchain-mcp-adapters, e.g.:',
          '    #   client = MultiServerMCPClient({...}); tools = await client.get_tools()',
          '    return {}',
          '',
        )
        break
      }
      case 'structuredOutput': {
        const className = structuredClassNames.get(node.id) ?? 'OutputModel'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Structured output node: ${pyDoc(node.data.label)} — enforces ${className}."""`,
          `    # TODO: structured = llm.with_structured_output(${className}).invoke(state["messages"])`,
          '    return {}',
          '',
        )
        break
      }
    }
  }

  // --- Graph wiring ---
  emit('# --- Graph ---')
  emit('builder = StateGraph(State)')
  for (const node of orderedNodes) {
    emit(`builder.add_node("${names.get(node.id)}", ${names.get(node.id)})`)
  }
  emit('')

  for (const start of startNodes) {
    for (const edge of wiredEdges.filter(
      (e) => e.source === start.id && graphIds.has(e.target),
    )) {
      emit(`builder.add_edge(START, "${names.get(edge.target)}")`)
    }
  }

  // Nodes with multiple outgoing edges get conditional routing; the rest
  // get plain edges. Condition routers were emitted above, so generate
  // generic routers for other fan-outs.
  const routedTypes: AgentFlowNodeType[] = ['condition']
  for (const node of orderedNodes) {
    const name = names.get(node.id)
    if (!name) continue
    const outs = outgoing(node.id)
    if (outs.length === 0) continue
    const targets = outs
      .map((e) => names.get(e.target))
      .filter((t): t is string => t !== undefined)
    if (outs.length === 1) {
      emit(`builder.add_edge("${name}", "${targets[0]}")`)
    } else if (node.type && routedTypes.includes(node.type)) {
      const mapping = targets.map((t) => `"${t}": "${t}"`).join(', ')
      emit(`builder.add_conditional_edges("${name}", route_${name}, {${mapping}})`)
    } else {
      const mapping = targets.map((t) => `"${t}": "${t}"`).join(', ')
      const defaultTargetId = pickDefaultTarget(
        node.id,
        outs.map((e) => e.target),
        wiredEdges,
        graphIds,
      )
      const defaultTarget = defaultTargetId ? names.get(defaultTargetId) : undefined
      emit(
        '',
        `def route_${name}(state: State) -> str:`,
        `    """Routing for '${pyDoc(node.data.label)}'."""`,
        '    # TODO: pick the next node',
        `    return "${defaultTarget ?? targets[0]}"`,
        '',
        `builder.add_conditional_edges("${name}", route_${name}, {${mapping}})`,
      )
    }
  }

  for (const node of orderedNodes.filter((n) => n.type === 'output')) {
    emit(`builder.add_edge("${names.get(node.id)}", END)`)
  }
  emit('')

  if (hasMemory) {
    const kinds = memoryNodes
      .map((n) => n.data.memoryType ?? 'short-term')
      .join(', ')
    emit(`# Memory nodes on canvas: ${kinds}`)
    emit('checkpointer = MemorySaver()')
  }
  const compileArgs: string[] = []
  if (hasMemory) compileArgs.push('checkpointer=checkpointer')
  if (hilNames.length > 0) {
    compileArgs.push(
      `interrupt_before=[${hilNames.map((n) => `"${n}"`).join(', ')}]`,
    )
  }
  emit(`graph = builder.compile(${compileArgs.join(', ')})`)
  emit('')

  const needsConfig = hasMemory || hilNames.length > 0
  const initialState =
    '{"messages": [{"role": "user", "content": "Hello!"}]' +
    fields.map((f) => `, "${f}": ""`).join('') +
    '}'

  if (options.asyncMode) {
    emit('async def main() -> None:')
    if (hasGemini) {
      emit('    if not os.environ.get("GOOGLE_API_KEY"):')
      emit('        raise SystemExit("GOOGLE_API_KEY is not set — add it to your .env file.")')
    }
    if (needsConfig) emit('    config = {"configurable": {"thread_id": "demo"}}')
    emit(`    state = ${initialState}`)
    emit(
      needsConfig
        ? '    result = await graph.ainvoke(state, config)'
        : '    result = await graph.ainvoke(state)',
    )
    emit('    print(result["messages"][-1].content)')
    emit('')
    emit('if __name__ == "__main__":')
    emit('    asyncio.run(main())')
  } else {
    emit('if __name__ == "__main__":')
    if (hasGemini) {
      emit('    if not os.environ.get("GOOGLE_API_KEY"):')
      emit('        raise SystemExit("GOOGLE_API_KEY is not set — add it to your .env file.")')
    }
    if (needsConfig) emit('    config = {"configurable": {"thread_id": "demo"}}')
    emit(`    state = ${initialState}`)
    emit(
      needsConfig
        ? '    result = graph.invoke(state, config)'
        : '    result = graph.invoke(state)',
    )
    emit('    print(result["messages"][-1].content)')
  }
  emit('')

  return lines.join('\n')
}
