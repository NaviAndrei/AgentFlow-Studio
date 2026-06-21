import type { AgentFlowEdge, AgentFlowNode, AgentFlowNodeType } from '../types'
import { topologicalSort } from './topologicalSort'
import { inferExportModel, resolveModelSetup } from './exportModels'
import type { ModelSetup } from './exportModels'
import { resolveNodePrompts } from './resolvePrompts'

export interface ExportOptions {
  /** Emit `async def` node functions and an async invoke example. */
  asyncMode: boolean
}

const DEFAULT_LLM_MODEL = 'gemini-2.5-flash'

/** Nodes that emit an LLM call needing a resolved model (besides plain LLM nodes). */
function needsInferredModel(node: AgentFlowNode): boolean {
  return (
    node.type === 'router' ||
    node.type === 'structuredOutput' ||
    node.type === 'evaluator' ||
    node.type === 'planner' ||
    node.type === 'subagent' ||
    (node.type === 'guardrail' && node.data.checkType === 'llm-judge')
  )
}

/** Every model id the exporter will instantiate, in node order. */
function collectModelIds(nodes: AgentFlowNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.type === 'llm') {
      ids.push(node.data.model ?? DEFAULT_LLM_MODEL)
    } else if (needsInferredModel(node)) {
      const inferred = inferExportModel(nodes, node)
      if (inferred) ids.push(inferred)
    }
  }
  return ids
}

/** Setups for every model the canvas instantiates, deduped by import line. */
export function modelSetupsFor(nodes: AgentFlowNode[]): ModelSetup[] {
  const seen = new Set<string>()
  const setups: ModelSetup[] = []
  for (const id of collectModelIds(nodes)) {
    const setup = resolveModelSetup(id)
    if (seen.has(setup.importLine)) continue
    seen.add(setup.importLine)
    setups.push(setup)
  }
  return setups
}

/** Node types that become graph nodes (memory and notes are handled separately). */
const GRAPH_NODE_TYPES: AgentFlowNodeType[] = [
  'llm',
  'agent',
  'tool',
  'output',
  'condition',
  'router',
  'guardrail',
  'join',
  'loop',
  'humanInLoop',
  'supervisor',
  'swarmWorker',
  'retriever',
  'mcpServer',
  'structuredOutput',
  'map',
  'codeExecutor',
  'evaluator',
  'subgraph',
  'longTermStore',
  'memoryWriter',
  'planner',
  'subagent',
  'computerUse',
  'a2aAgent',
  'multimodalInput',
  'tryCatch',
  'retry',
  'httpRequest',
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
 * Parse a Subgraph node's input/output mapping JSON ('{"from": "to"}') into
 * ordered [from, to] string pairs. Invalid or non-string entries are dropped,
 * mirroring the simulation's tolerant `JSON.parse` handling.
 */
function parseMapping(raw: string | undefined): [string, string][] {
  if (!raw || raw.trim() === '') return []
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null) return []
    return Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    )
  } catch {
    return []
  }
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

const JSON_TO_PY_TYPE: Record<string, string> = {
  string: 'str',
  number: 'float',
  integer: 'int',
  boolean: 'bool',
  array: 'list',
  object: 'dict',
}

export interface PydanticField {
  name: string
  /** The bare Python type, e.g. "str". */
  type: string
  /** True when the field is not in the schema's `required` list. */
  optional: boolean
}

/**
 * Parse a JSON-Schema object into Pydantic field descriptors. Returns null
 * when the schema can't be parsed or declares no object properties, so the
 * caller falls back to a single `answer: str` field.
 */
export function pydanticFieldsFromSchema(schema: string): PydanticField[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(schema)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as {
    properties?: Record<string, { type?: unknown }>
    required?: unknown
  }
  const props = obj.properties
  if (typeof props !== 'object' || props === null) return null
  const entries = Object.entries(props)
  if (entries.length === 0) return null
  const required = new Set(
    Array.isArray(obj.required)
      ? obj.required.filter((r): r is string => typeof r === 'string')
      : [],
  )
  const used = new Set<string>()
  const fields: PydanticField[] = []
  for (const [rawName, spec] of entries) {
    const name = pyIdent(rawName, used)
    const jsonType = typeof spec?.type === 'string' ? spec.type : 'string'
    fields.push({
      name,
      type: JSON_TO_PY_TYPE[jsonType] ?? 'str',
      optional: !required.has(rawName),
    })
  }
  return fields
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
  const lines = ['langgraph']
  for (const setup of modelSetupsFor(nodes)) {
    lines.push(setup.requirement)
  }
  if (nodes.some((n) => n.type === 'structuredOutput')) lines.push('pydantic')
  if (nodes.some((n) => n.type === 'mcpServer')) {
    lines.push('langchain-mcp-adapters')
  }
  if (nodes.some((n) => n.type === 'codeExecutor')) {
    lines.push('langchain-experimental')
  }
  if (nodes.some((n) => n.type === 'memoryWriter')) {
    lines.push('langmem')
  }
  if (nodes.some((n) => n.type === 'computerUse')) {
    lines.push('anthropic')
  }
  if (nodes.some((n) => n.type === 'a2aAgent' || n.type === 'httpRequest')) {
    lines.push('httpx')
  }
  lines.push('python-dotenv')
  return lines.join('\n') + '\n'
}

/** Env var names the exported flow reads at runtime, deduped, in first-seen order. */
export function exportEnvVars(nodes: AgentFlowNode[]): string[] {
  const vars = [
    ...new Set(
      modelSetupsFor(nodes)
        .map((s) => s.envVar)
        .filter((v): v is string => !!v),
    ),
  ]
  if (nodes.some((n) => n.type === 'a2aAgent' && (n.data.authToken ?? '').trim() !== '')) {
    vars.push('A2A_TOKEN')
  }
  return vars
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

  const HEADER =
    '# Generated by AgentFlow Studio — https://github.com/NaviAndrei/AgentFlow-Studio\n' +
    '# LangGraph version: langgraph>=0.2\n' +
    '# Python version: >=3.11\n' +
    '#\n' +
    '# Auto-generated — manual edits will be overwritten on re-export.\n'

  if (graphNodes.length === 0 && startNodes.length === 0) {
    return `${HEADER}# Empty canvas — add some nodes before exporting.\n`
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

  const modelSetups = modelSetupsFor(nodes)
  // os is needed both for env guards and any setup reading os.environ.
  const envVars = [
    ...new Set(modelSetups.map((s) => s.envVar).filter((v): v is string => !!v)),
  ]
  // A2A nodes with an auth token read os.environ["A2A_TOKEN"] at runtime.
  const a2aNeedsAuth = graphNodes.some(
    (n) => n.type === 'a2aAgent' && (n.data.authToken ?? '').trim() !== '',
  )
  const needsOs =
    envVars.length > 0 ||
    a2aNeedsAuth ||
    modelSetups.some((s) => s.pythonLine('m', 0).includes('os.environ'))
  const hasTools = nodes.some((n) => n.type === 'tool')
  // Only checkpointer / short-term memory becomes a LangGraph checkpointer;
  // a vector-store memory belongs to a Retriever, not the graph compile.
  const checkpointerNodes = memoryNodes.filter(
    (n) => (n.data.memoryType ?? 'short-term') !== 'vector-store',
  )
  const vectorStoreNodes = memoryNodes.filter(
    (n) => n.data.memoryType === 'vector-store',
  )
  const hasCheckpointer = checkpointerNodes.length > 0
  const hilNames = graphNodes
    .filter((n) => n.type === 'humanInLoop')
    .map((n) => names.get(n.id))
    .filter((n): n is string => n !== undefined)
  const fields = stateFields(nodes)

  const lines: string[] = []
  const emit = (...added: string[]) => lines.push(...added)

  const structuredNodes = graphNodes.filter(
    (n) => n.type === 'structuredOutput',
  )
  const routerNodes = graphNodes.filter((n) => n.type === 'router')
  const llmJudgeNodes = graphNodes.filter(
    (n) => n.type === 'guardrail' && n.data.checkType === 'llm-judge',
  )
  const evaluatorNodes = graphNodes.filter((n) => n.type === 'evaluator')
  const plannerNodes = graphNodes.filter((n) => n.type === 'planner')
  // Parse each structured-output schema once; null means fall back to answer:str.
  const structuredFields = new Map<string, ReturnType<typeof pydanticFieldsFromSchema>>()
  for (const n of structuredNodes) {
    structuredFields.set(n.id, pydanticFieldsFromSchema(n.data.jsonSchema ?? ''))
  }
  // Routers, llm-judge guardrails, and evaluators emit a Literal classifier schema.
  const needsLiteral =
    routerNodes.length > 0 || llmJudgeNodes.length > 0 || evaluatorNodes.length > 0
  // Optional[...] is needed when any parsed schema has a non-required field.
  const needsOptional = [...structuredFields.values()].some(
    (fields) => fields !== null && fields.some((f) => f.optional),
  )
  const needsPydantic =
    structuredNodes.length > 0 ||
    routerNodes.length > 0 ||
    llmJudgeNodes.length > 0 ||
    evaluatorNodes.length > 0 ||
    plannerNodes.length > 0
  // pass/fail target names resolved per guardrail node, consumed by wiring.
  const guardrailTargets = new Map<string, { pass: string; fail: string }>()
  // onSuccess/onError target names resolved per Try/Catch node.
  const tryCatchTargets = new Map<string, { onSuccess: string; onError: string }>()
  // Concat joins accumulate branch outputs in a reduced state key.
  const concatJoins = graphNodes.filter(
    (n) => n.type === 'join' && (n.data.mergeStrategy ?? 'concat') === 'concat',
  )
  const mapNodes = graphNodes.filter((n) => n.type === 'map')
  const needsOperator = concatJoins.length > 0 || mapNodes.length > 0
  const needsSend = mapNodes.length > 0

  emit('"""Generated by AgentFlow Studio."""', '')
  if (options.asyncMode) emit('import asyncio')
  if (graphNodes.some((n) => n.type === 'retry')) emit('import time')
  if (needsOs) emit('import os')
  if (needsOperator) emit('import operator')
  emit(
    `from typing import Annotated, TypedDict${needsLiteral ? ', Literal' : ''}${needsOptional ? ', Optional' : ''}`,
  )
  emit('')
  emit('from langgraph.graph import StateGraph, START, END')
  emit('from langgraph.graph.message import add_messages')
  if (needsSend) emit('from langgraph.types import Send')
  const needsToolNode = graphNodes.some(
    (n) => n.type === 'agent' && (n.data.tools ?? []).filter(Boolean).length > 0,
  )
  if (needsToolNode) emit('from langgraph.prebuilt import ToolNode')
  if (needsPydantic) emit('from pydantic import BaseModel')
  if (hasCheckpointer) emit('from langgraph.checkpoint.memory import MemorySaver')
  const longTermStoreNodes = graphNodes.filter((n) => n.type === 'longTermStore')
  const hasStore = longTermStoreNodes.length > 0
  if (hasStore) emit('from langgraph.store.memory import InMemoryStore')
  if (graphNodes.some((n) => n.type === 'computerUse')) {
    emit('from anthropic import Anthropic')
  }
  if (graphNodes.some((n) => n.type === 'a2aAgent' || n.type === 'httpRequest')) {
    emit('import httpx')
  }
  if (graphNodes.some((n) => n.type === 'multimodalInput')) {
    emit('from langchain_core.messages import HumanMessage')
  }
  for (const setup of modelSetups) emit(setup.importLine)
  if (hasTools) emit('from langchain_core.tools import tool')
  emit('')

  // --- State ---
  emit('# --- State ---')
  emit('class State(TypedDict):')
  emit('    messages: Annotated[list, add_messages]')
  for (const field of fields) {
    emit(`    ${field}: str`)
  }
  // Each Map node fans out over a list living under state[inputExpression].
  // Declare every distinct source key as a list field; also declare 'item'
  // since each Send dispatches {"item": ...} into the per-branch state.
  const mapSources = new Set<string>()
  for (const n of mapNodes) {
    const src = (n.data.inputExpression ?? 'items').trim() || 'items'
    if (src !== 'messages') mapSources.add(src)
  }
  for (const src of mapSources) {
    emit(`    ${src}: list`)
  }
  if (mapNodes.length > 0) {
    emit('    item: str')
  }
  const hasPlanner = orderedNodes.some((n) => n.type === 'planner')
  // Don't double-declare if a Map already declared "todos" as a source list.
  if (hasPlanner && !mapSources.has('todos')) {
    emit('    todos: list')
  }
  if (needsOperator) {
    // Parallel branches feeding a concat join append to this reduced list.
    emit('    branch_results: Annotated[list, operator.add]')
  }
  emit('')

  // Subgraph stubs use a messages-only schema: reusing the full State would
  // make sibling subgraphs echo every plain field back as a concurrent write
  // to the same last_value channel, which LangGraph rejects.
  const subgraphNodes = orderedNodes.filter((n) => n.type === 'subgraph')
  if (subgraphNodes.length > 0) {
    emit('class SubgraphState(TypedDict):')
    emit('    messages: Annotated[list, add_messages]')
    emit('')
  }

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
      emit(`class ${className}(BaseModel):`)
      emit(`    """Structured output for ${pyDoc(node.data.label)}."""`)
      const fields = structuredFields.get(node.id)
      if (fields && fields.length > 0) {
        for (const f of fields) {
          emit(
            f.optional
              ? `    ${f.name}: Optional[${f.type}] = None`
              : `    ${f.name}: ${f.type}`,
          )
        }
      } else {
        // Schema absent or unparseable — emit a single safe default field.
        const schema = (node.data.jsonSchema ?? '').trim().replace(/\s+/g, ' ')
        if (schema) emit(`    # schema: ${schema.slice(0, 160)}`)
        emit('    answer: str')
      }
      emit('')
    }
  }

  // --- Models ---
  const llmNodes = orderedNodes.filter((n) => n.type === 'llm')
  // Router (and llm-judge guardrail) nodes get their own classifier model var,
  // resolved via the shared model-source policy. Null = no model on canvas, so
  // the node emits an honest TODO instead.
  const inferredModelNodes = orderedNodes.filter(needsInferredModel)
  const inferredModelVar = new Map<string, string>()
  if (llmNodes.length > 0 || inferredModelNodes.length > 0) {
    emit('# --- Models ---')
    for (const node of llmNodes) {
      const model = node.data.model ?? DEFAULT_LLM_MODEL
      const temp = node.data.temperature ?? 0.7
      emit(resolveModelSetup(model).pythonLine(`${names.get(node.id)}_model`, temp))
    }
    for (const node of inferredModelNodes) {
      const model = inferExportModel(nodes, node)
      if (model === null) continue
      const varName = `${names.get(node.id)}_model`
      inferredModelVar.set(node.id, varName)
      emit(resolveModelSetup(model).pythonLine(varName, node.data.temperature ?? 0))
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
        const prompt = resolveNodePrompts(node.data).systemPrompt || 'You are a helpful assistant.'
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
        const toolIdents = tools.map((t) => t.trim().replace(/[^a-zA-Z0-9_]/g, '_')).filter(Boolean)
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Agent node: ${pyDoc(node.data.label)} (tools: ${pyDoc(JSON.stringify(tools))}, max ${node.data.maxIterations ?? 10} iterations)."""`,
        )
        if (toolIdents.length > 0) {
          emit(
            `    # Tools: ${toolIdents.join(', ')}`,
            `    tool_node = ToolNode(tools=[${toolIdents.join(', ')}])`,
          )
        }
        emit(
          '    # TODO: implement the agent loop, e.g. with langgraph.prebuilt:',
          '    #   from langgraph.prebuilt import create_react_agent',
          `    #   agent = create_react_agent(model, tools=${toolIdents.length > 0 ? `[${toolIdents.join(', ')}]` : '[...]'})`,
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
      case 'router': {
        const outs = outgoing(node.id)
        const declaredRoutes = (node.data.routes ?? []).filter(Boolean)
        // No declared routes but the canvas already labels the outgoing
        // edges — derive the classifier's routes from those labels instead
        // of falling back to the generic "no model" placeholder.
        const labeledRoutes = [
          ...new Set(
            outs
              .map((e) => (typeof e.label === 'string' ? e.label.trim() : ''))
              .filter((l) => l !== ''),
          ),
        ]
        const routes = declaredRoutes.length > 0 ? declaredRoutes : labeledRoutes
        // Map each route name to the node its labeled edge points at.
        const routeTarget = new Map<string, string>()
        for (const e of outs) {
          const label =
            typeof e.label === 'string' && e.label !== ''
              ? e.label
              : (names.get(e.target) ?? '')
          const target = names.get(e.target)
          if (target) routeTarget.set(label, target)
        }
        const defaultTargetId = pickDefaultTarget(
          node.id,
          outs.map((e) => e.target),
          wiredEdges,
          graphIds,
        )
        const defaultTarget =
          (defaultTargetId ? names.get(defaultTargetId) : undefined) ??
          [...routeTarget.values()][0] ??
          'END'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Router node: ${pyDoc(node.data.label)} — classifies into ${pyDoc(JSON.stringify(routes))}."""`,
          '    return {}',
          '',
        )
        const modelVar = inferredModelVar.get(node.id)
        const mapEntries = routes
          .map((r) => `"${r}": "${routeTarget.get(r) ?? defaultTarget}"`)
          .join(', ')
        if (modelVar && routes.length > 0) {
          const literal = routes.map((r) => pyStr(r)).join(', ')
          const prompt = `${node.data.routingPrompt ?? 'Classify the request.'} Respond with one of: ${routes.join(', ')}.`
          emit(
            `def route_${name}(state: State) -> str:`,
            `    """Routing for '${pyDoc(node.data.label)}'."""`,
            `    class _Route(BaseModel):`,
            `        route: Literal[${literal}]`,
            `    decision = ${modelVar}.with_structured_output(_Route).invoke(`,
            `        [{"role": "system", "content": ${pyStr(prompt)}}, *state["messages"]]`,
            '    )',
            `    targets = {${mapEntries}}`,
            `    return targets.get(decision.route, "${defaultTarget}")`,
            '',
          )
        } else {
          emit(
            `def route_${name}(state: State) -> str:`,
            `    """Routing for '${pyDoc(node.data.label)}'."""`,
            '    # TODO: no model on canvas — add an LLM node or set Override model.',
            `    return "${defaultTarget}"`,
            '',
          )
        }
        break
      }
      case 'guardrail': {
        const outs = outgoing(node.id)
        const targetOf = (label: string): string | undefined => {
          const e = outs.find(
            (o) =>
              (typeof o.label === 'string' && o.label !== ''
                ? o.label
                : names.get(o.target)) === label,
          )
          return e ? names.get(e.target) : undefined
        }
        const passTarget = targetOf('pass') ?? 'END'
        const failTarget = targetOf('fail') ?? 'END'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Guardrail node: ${pyDoc(node.data.label)} (${node.data.checkType ?? 'keyword'})."""`,
          '    return {}',
          '',
        )
        if ((node.data.checkType ?? 'keyword') === 'keyword') {
          const terms = (node.data.criteria ?? '')
            .split(/[\n,]/)
            .map((t) => t.trim())
            .filter(Boolean)
          emit(
            `def route_${name}(state: State) -> str:`,
            `    """Keyword guardrail for '${pyDoc(node.data.label)}'."""`,
            '    content = str(state["messages"][-1].content).lower()',
            `    terms = ${JSON.stringify(terms)}`,
            '    return "pass" if any(t.lower() in content for t in terms) else "fail"',
            '',
          )
        } else {
          const modelVar = inferredModelVar.get(node.id)
          if (modelVar) {
            const rubric = node.data.criteria ?? 'Judge whether the response is acceptable.'
            emit(
              `def route_${name}(state: State) -> str:`,
              `    """LLM-judge guardrail for '${pyDoc(node.data.label)}'."""`,
              '    class _Verdict(BaseModel):',
              '        verdict: Literal["pass", "fail"]',
              `    decision = ${modelVar}.with_structured_output(_Verdict).invoke(`,
              `        [{"role": "system", "content": ${pyStr(`${rubric} Reply pass or fail.`)}}, *state["messages"]]`,
              '    )',
              '    return decision.verdict',
              '',
            )
          } else {
            emit(
              `def route_${name}(state: State) -> str:`,
              `    """LLM-judge guardrail for '${pyDoc(node.data.label)}'."""`,
              '    # TODO: no model on canvas — add an LLM node or set Override model.',
              '    return "pass"',
              '',
            )
          }
        }
        // Expose the resolved targets so the wiring section maps them.
        guardrailTargets.set(node.id, { pass: passTarget, fail: failTarget })
        break
      }
      case 'tryCatch': {
        const outs = outgoing(node.id)
        const targetOf = (label: string): string | undefined => {
          const e = outs.find((o) => o.label === label)
          return e ? names.get(e.target) : undefined
        }
        const onSuccessTarget = targetOf('onSuccess') ?? 'END'
        const onErrorTarget = targetOf('onError') ?? 'END'
        const fallback = node.data.tryCatch?.fallbackOutput ?? ''
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Try/Catch node: ${pyDoc(node.data.label)} — guards the onSuccess branch."""`,
          '    try:',
          '        # TODO: the guarded nodes run here in the compiled graph; this',
          '        # wrapper only tracks success/failure for routing.',
          `        return {"trycatch_${name}_result": "success"}`,
          '    except Exception as e:',
          `        return {"trycatch_${name}_result": "error", "trycatch_${name}_error": str(e), "messages": [{"role": "assistant", "content": ${pyStr(fallback)}}]}`,
          '',
        )
        emit(
          `def route_${name}(state: State) -> str:`,
          `    """Routing for Try/Catch '${pyDoc(node.data.label)}'."""`,
          `    return state.get("trycatch_${name}_result", "success")`,
          '',
        )
        tryCatchTargets.set(node.id, { onSuccess: onSuccessTarget, onError: onErrorTarget })
        break
      }
      case 'retry': {
        const cfg = node.data.retry ?? {
          maxAttempts: 3,
          backoffMs: 1000,
          backoffMultiplier: 2.0,
          retryOn: ['error'] as const,
        }
        const backoffSec = cfg.backoffMs / 1000
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Retry node: ${pyDoc(node.data.label)} — retries the next node up to ${cfg.maxAttempts}x with backoff."""`,
          `    for attempt in range(${cfg.maxAttempts}):`,
          '        try:',
          "            # TODO: the wrapped node's logic runs here",
          '            return {}',
          '        except Exception as e:',
          `            if attempt < ${cfg.maxAttempts} - 1:`,
          `                time.sleep(${backoffSec} * ${cfg.backoffMultiplier} ** attempt)`,
          '            else:',
          '                raise',
          '',
        )
        break
      }
      case 'evaluator': {
        const branches = (node.data.evalBranches ?? ['pass', 'fail']).filter(
          Boolean,
        )
        const outs = outgoing(node.id)
        const targetByLabel = new Map<string, string>()
        for (const e of outs) {
          const label =
            typeof e.label === 'string' && e.label !== ''
              ? e.label
              : (names.get(e.target) ?? '')
          const target = names.get(e.target)
          if (target) targetByLabel.set(label, target)
        }
        const defaultTargetId = pickDefaultTarget(
          node.id,
          outs.map((e) => e.target),
          wiredEdges,
          graphIds,
        )
        const defaultTarget =
          (defaultTargetId ? names.get(defaultTargetId) : undefined) ??
          [...targetByLabel.values()][0] ??
          'END'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Evaluator node: ${pyDoc(node.data.label)} (${node.data.scoreType ?? 'pass_fail'})."""`,
          '    return {}',
          '',
        )
        const modelVar = inferredModelVar.get(node.id)
        const mapEntries = branches
          .map((b) => `"${b}": "${targetByLabel.get(b) ?? defaultTarget}"`)
          .join(', ')
        if (modelVar && branches.length > 0) {
          const literal = branches.map((b) => pyStr(b)).join(', ')
          const rubric = node.data.scoringPrompt ?? 'Score the response.'
          emit(
            `def route_${name}(state: State) -> str:`,
            `    """LLM-as-judge for '${pyDoc(node.data.label)}'."""`,
            `    class _Grade(BaseModel):`,
            `        verdict: Literal[${literal}]`,
            `    decision = ${modelVar}.with_structured_output(_Grade).invoke(`,
            `        [{"role": "system", "content": ${pyStr(`${rubric} Reply with one of: ${branches.join(', ')}.`)}}, *state["messages"]]`,
            '    )',
            `    targets = {${mapEntries}}`,
            `    return targets.get(decision.verdict, "${defaultTarget}")`,
            '',
          )
        } else {
          emit(
            `def route_${name}(state: State) -> str:`,
            `    """LLM-as-judge for '${pyDoc(node.data.label)}'."""`,
            '    # TODO: no model on canvas — add an LLM node or set Override model.',
            `    return "${defaultTarget}"`,
            '',
          )
        }
        break
      }
      case 'join': {
        const strategy = node.data.mergeStrategy ?? 'concat'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Join node: ${pyDoc(node.data.label)} — synchronization barrier (merge: ${strategy})."""`,
          '    # LangGraph runs this once every incoming branch has completed.',
          strategy === 'concat'
            ? '    # Branch outputs are accumulated in state["branch_results"].'
            : '    # Keep the most recent branch result.',
          '    return {}',
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
      case 'subgraph': {
        // subgraphRef is overloaded: a short name, OR (when authored on the
        // canvas) the inline inner-graph JSON. Only echo it as a reference when
        // it's a plain name, so the comment doesn't dump a whole graph blob.
        const rawRef = (node.data.subgraphRef ?? '').trim()
        const ref =
          rawRef !== '' && !rawRef.startsWith('{') ? rawRef : node.data.label
        const inputMap = parseMapping(node.data.inputMapping)
        const outputMap = parseMapping(node.data.outputMapping)
        emit(
          `# --- Subgraph: ${pyDoc(node.data.label)} (${pyDoc(ref)}) ---`,
          `def build_${name}_subgraph():`,
          `    """${pyDoc(node.data.subgraphSummary ?? `Inner graph for ${node.data.label}.`)}"""`,
          '    inner = StateGraph(SubgraphState)',
          '    # TODO: define inner nodes and edges for this subgraph,',
          `    #       referencing the saved canvas "${pyDoc(ref)}".`,
          '    inner.add_node("placeholder", lambda state: {})',
          '    inner.add_edge(START, "placeholder")',
          '    inner.add_edge("placeholder", END)',
          '    return inner.compile()',
          '',
          `${name}_inner = build_${name}_subgraph()`,
          '',
        )
        // Wrapper node: the inner graph speaks SubgraphState, so remap parent
        // State into its input namespace, invoke it, then map the result back.
        // Without this, parent and inner schemas would have to share channels.
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Subgraph wrapper for ${pyDoc(node.data.label)}: map parent state into`,
          '    the inner graph, invoke it, then map the result back out."""',
          '    inner_input = {"messages": state["messages"]}',
        )
        for (const [parentKey, innerKey] of inputMap) {
          emit(
            `    inner_input[${pyStr(innerKey)}] = state.get(${pyStr(parentKey)})  # inputMapping`,
          )
        }
        emit(`    result = ${invoke(`${name}_inner`, 'inner_input')}`)
        if (outputMap.length === 0) {
          emit('    return {"messages": result.get("messages", [])}', '')
        } else {
          emit('    update: dict = {"messages": result.get("messages", [])}')
          for (const [innerKey, parentKey] of outputMap) {
            emit(
              `    if ${pyStr(innerKey)} in result:`,
              `        update[${pyStr(parentKey)}] = result[${pyStr(innerKey)}]  # outputMapping`,
            )
          }
          emit('    return update', '')
        }
        break
      }
      case 'longTermStore': {
        const namespace = node.data.namespace ?? 'user_memories'
        const op = node.data.storeOperation ?? 'read'
        emit(
          `${defKeyword} ${name}(state: State, *, store) -> dict:`,
          `    """Long-Term Store ${op} on namespace "${pyDoc(namespace)}"."""`,
          `    namespace = (${pyStr(namespace)},)`,
        )
        if (op === 'write') {
          emit(
            '    last = str(state["messages"][-1].content)',
            '    import uuid',
            '    store.put(namespace, str(uuid.uuid4()), {"data": last})',
            '    return {"messages": [{"role": "user", "content": "[store] wrote 1 memory"}]}',
            '',
          )
        } else if (op === 'search') {
          const q = node.data.searchQuery ?? 'state["messages"][-1].content'
          emit(
            '    last = str(state["messages"][-1].content)',
            `    hits = store.search(namespace, query=${pyStr(q)} or last, limit=5)`,
            '    recalled = "; ".join(h.value.get("data", "") for h in hits)',
            '    return {"messages": [{"role": "user", "content": f"[store search] {recalled}"}]}',
            '',
          )
        } else {
          emit(
            '    last = str(state["messages"][-1].content)',
            '    hits = store.search(namespace, query=last, limit=5)',
            '    recalled = "; ".join(h.value.get("data", "") for h in hits)',
            '    return {"messages": [{"role": "user", "content": f"[store] {recalled}"}]}',
            '',
          )
        }
        break
      }
      case 'memoryWriter': {
        const kind = node.data.memoryKind ?? 'episodic'
        const ns = node.data.writeNamespace ?? 'user_memories'
        emit(
          `${defKeyword} ${name}(state: State, *, store) -> dict:`,
          `    """Memory Writer (LangMem): extract ${kind} memories into "${pyDoc(ns)}"."""`,
          `    # manager = create_memory_manager(model, kinds=["${kind}"])`,
          '    # extracted = manager.invoke({"messages": state["messages"]})',
          '    # for item in extracted: store.put((' + pyStr(ns) + ',), item.id, item.value)',
          '    return {}',
          '',
        )
        break
      }
      case 'multimodalInput': {
        const inputType = node.data.inputType ?? 'image'
        const textPrompt = node.data.textPrompt ?? 'Describe what you see'
        const encoding = node.data.encoding ?? 'url'
        const inputVar = node.data.inputVariable ?? 'file_input'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Multimodal Input: ${pyDoc(node.data.label)} (${inputType}, ${encoding})."""`,
          `    # Provide the ${inputType} payload via state["${pyDoc(inputVar)}"] at invoke time.`,
          `    payload = state.get("${inputVar}", "")`,
        )
        if (inputType === 'audio') {
          emit(
            '    # Audio requires an OpenAI/Gemini model that supports input_audio.',
            '    content = [',
            `        {"type": "text", "text": ${pyStr(textPrompt)}},`,
            '        {"type": "input_audio", "input_audio": {"data": payload, "format": "wav"}},',
            '    ]',
          )
        } else {
          const urlValue =
            encoding === 'base64'
              ? `f"data:image/png;base64,{payload}"`
              : 'payload'
          emit(
            '    content = [',
            `        {"type": "text", "text": ${pyStr(textPrompt)}},`,
            `        {"type": "image_url", "image_url": {"url": ${urlValue}}},`,
            '    ]',
          )
        }
        emit(
          '    return {"messages": [HumanMessage(content=content)]}',
          '',
        )
        break
      }
      case 'a2aAgent': {
        const url = node.data.agentUrl ?? 'http://localhost:8000/a2a'
        const agentName = node.data.agentName ?? 'Remote Agent'
        const task = node.data.taskDescription ?? 'Delegate this task.'
        const timeout = node.data.timeoutSeconds ?? 30
        const hasAuth = (node.data.authToken ?? '').trim() !== ''
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """A2A call to ${pyDoc(agentName)} at ${pyDoc(url)}."""`,
          `    task = ${pyStr(task)}`,
          '    payload = {',
          '        "jsonrpc": "2.0",',
          '        "id": "1",',
          '        "method": "tasks/send",',
          '        "params": {"message": {"role": "user", "parts": [{"type": "text", "text": task}]}},',
          '    }',
          hasAuth
            ? '    headers = {"Authorization": f"Bearer {os.environ[\'A2A_TOKEN\']}"}'
            : '    headers = {}',
        )
        if (options.asyncMode) {
          emit(
            `    async with httpx.AsyncClient(timeout=${timeout}) as client:`,
            `        resp = await client.post(${pyStr(url)}, json=payload, headers=headers)`,
            '    data = resp.json()',
          )
        } else {
          emit(
            `    resp = httpx.post(${pyStr(url)}, json=payload, headers=headers, timeout=${timeout})`,
            '    data = resp.json()',
          )
        }
        emit(
          '    text = str(data.get("result", data))',
          '    return {"messages": [{"role": "user", "content": f"[a2a] {text}"}]}',
          '',
        )
        break
      }
      case 'computerUse': {
        const model = node.data.model ?? 'claude-sonnet-4-6'
        const maxSteps = node.data.maxSteps ?? 10
        const task = node.data.task ?? 'Complete the assigned task.'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Computer Use: ${pyDoc(node.data.label)} — screenshot→action loop (max ${maxSteps} steps)."""`,
          '    client = Anthropic()',
          `    task = ${pyStr(task)}`,
          '    messages = [{"role": "user", "content": task}]',
          '    tools = [{',
          '        "type": "computer_20241022",',
          '        "name": "computer",',
          '        "display_width_px": 1280,',
          '        "display_height_px": 800,',
          '    }]',
          `    for _ in range(${maxSteps}):`,
          '        response = client.beta.messages.create(',
          `            model=${pyStr(model)},`,
          '            max_tokens=1024,',
          '            tools=tools,',
          '            messages=messages,',
          '            betas=["computer-use-2024-10-22"],',
          '        )',
          '        if response.stop_reason != "tool_use":',
          '            break',
          '        # TODO: execute each tool_use block against a sandboxed browser,',
          '        #       then append a tool_result with the new screenshot.',
          '        messages.append({"role": "assistant", "content": response.content})',
          '        messages.append({"role": "user", "content": "[tool_result: TODO screenshot]"})',
          '    summary = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")',
          '    return {"messages": [{"role": "assistant", "content": summary or "computer-use done"}]}',
          '',
        )
        break
      }
      case 'planner': {
        const modelVar = inferredModelVar.get(node.id)
        const maxTasks = node.data.maxTasks ?? 5
        const prompt = node.data.decompositionPrompt ?? 'Decompose the task.'
        if (modelVar) {
          emit(
            `${defKeyword} ${name}(state: State) -> dict:`,
            `    """Planner: decompose the goal into todos (Deep Agents write_todos, max ${maxTasks})."""`,
            `    class _Plan(BaseModel):`,
            `        todos: list[str]`,
            `    plan = ${modelVar}.with_structured_output(_Plan).invoke(`,
            `        [{"role": "system", "content": ${pyStr(`${prompt} Output at most ${maxTasks} subtasks.`)}}, *state["messages"]]`,
            '    )',
            `    return {"todos": plan.todos[:${maxTasks}]}`,
            '',
          )
        } else {
          emit(
            `${defKeyword} ${name}(state: State) -> dict:`,
            `    """Planner: decompose the goal into todos."""`,
            '    # TODO: no model on canvas — add an LLM node or set Override model.',
            '    return {"todos": ["subtask 1", "subtask 2"]}',
            '',
          )
        }
        break
      }
      case 'subagent': {
        const role = node.data.role ?? 'Worker'
        const tools = (node.data.tools ?? []).filter(Boolean)
        const taskInput = node.data.taskInput ?? 'task'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Subagent (${pyDoc(role)}): isolated-context delegate (Deep Agents)."""`,
          `    task = state.get("item") or state.get("${taskInput}", "")`,
          '    # Isolated context: a fresh message list, then merge a compressed result',
          '    # back into the parent. Replace this stub with create_react_agent.',
          '    # from langgraph.prebuilt import create_react_agent',
          `    # agent = create_react_agent(model, tools=${JSON.stringify(tools)})`,
          '    # result = agent.invoke({"messages": [{"role": "user", "content": task}]})',
          `    return {"messages": [{"role": "assistant", "content": f"[${pyDoc(role)}] handled: {task}"}]}`,
          '',
        )
        break
      }
      case 'codeExecutor': {
        const lang = node.data.language ?? 'python'
        const timeout = node.data.timeout ?? 30
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Code Executor: ${pyDoc(node.data.label)} (${lang}, timeout=${timeout}s)."""`,
          '    # The previous message is expected to contain a code block from an upstream LLM.',
          '    code = str(state["messages"][-1].content)',
          lang === 'python'
            ? '    # TODO: wire a sandbox, e.g. langchain_experimental.utilities.PythonREPL'
            : `    # TODO: wire a sandbox runtime for ${lang}`,
          '    # repl = PythonREPL()',
          '    # result = repl.run(code)',
          '    result = "(stub) exit_code=0"',
          '    return {"messages": [{"role": "user", "content": f"[exec] {result}"}]}',
          '',
        )
        break
      }
      case 'map': {
        const source = (node.data.inputExpression ?? 'items').trim() || 'items'
        emit(
          `${defKeyword} ${name}(state: State) -> dict:`,
          `    """Map node: ${pyDoc(node.data.label)} — fan out one Send per item in state["${pyDoc(source)}"]."""`,
          '    # Body is a no-op; the fan-out happens in the conditional edge below.',
          '    return {}',
          '',
        )
        // Resolve the downstream target(s) the Send will dispatch to.
        const outs = outgoing(node.id)
        const targets = outs
          .map((e) => names.get(e.target))
          .filter((t): t is string => t !== undefined)
        const sendLines = targets.length > 0
          ? targets.map(
              (t) =>
                `        Send("${t}", {"item": item}) for item in state.get("${source}", [])`,
            )
          : [`        # TODO: wire an outgoing edge so Send has a target`]
        emit(
          `def route_${name}(state: State):`,
          `    """Send fan-out for '${pyDoc(node.data.label)}' over state["${pyDoc(source)}"]."""`,
          '    return [',
          ...sendLines.map((l, i) => (i < sendLines.length - 1 ? `${l},` : l)),
          '    ]',
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
        const modelVar = inferredModelVar.get(node.id)
        if (modelVar) {
          emit(
            `${defKeyword} ${name}(state: State) -> dict:`,
            `    """Structured output node: ${pyDoc(node.data.label)} — enforces ${className}."""`,
            `    result = ${modelVar}.with_structured_output(${className}).invoke(state["messages"])`,
            '    return {"messages": [{"role": "assistant", "content": result.model_dump_json()}]}',
            '',
          )
        } else {
          emit(
            `${defKeyword} ${name}(state: State) -> dict:`,
            `    """Structured output node: ${pyDoc(node.data.label)} — enforces ${className}."""`,
            '    # TODO: no model on canvas — add an LLM node or set Override model.',
            `    # result = model.with_structured_output(${className}).invoke(state["messages"])`,
            '    return {}',
            '',
          )
        }
        break
      }
      case 'httpRequest': {
        const url = node.data.httpUrl ?? ''
        const method = (node.data.httpMethod ?? 'GET').toLowerCase()
        const timeoutSec = (node.data.httpTimeoutMs ?? 10000) / 1000
        const hasHeaders =
          !!node.data.httpHeaders && node.data.httpHeaders.trim() !== '{}'
        const hasBody =
          ['post', 'put', 'patch'].includes(method) && !!node.data.httpBody
        if (options.asyncMode) {
          emit(
            `${defKeyword} ${name}(state: State) -> dict:`,
            `    """HTTP ${method.toUpperCase()} to ${pyDoc(url)}."""`,
            `    async with httpx.AsyncClient(timeout=${timeoutSec}) as client:`,
            `        resp = await client.${method}(`,
            `            ${pyStr(url)},`,
          )
          if (hasHeaders) emit(`            headers=${node.data.httpHeaders},`)
          if (hasBody) emit(`            content=${pyStr(node.data.httpBody ?? '')},`)
          emit('        )', '    resp.raise_for_status()')
        } else {
          emit(
            `${defKeyword} ${name}(state: State) -> dict:`,
            `    """HTTP ${method.toUpperCase()} to ${pyDoc(url)}."""`,
            `    resp = httpx.${method}(`,
            `        ${pyStr(url)},`,
          )
          if (hasHeaders) emit(`        headers=${node.data.httpHeaders},`)
          if (hasBody) emit(`        content=${pyStr(node.data.httpBody ?? '')},`)
          emit(`        timeout=${timeoutSec},`, '    )', '    resp.raise_for_status()')
        }
        emit(
          '    try:',
          '        result = resp.json()',
          '    except Exception:',
          '        result = resp.text',
          '    return {"messages": [{"role": "assistant", "content": str(result)}]}',
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

  // Dedupes by target name: LangGraph's START is a single virtual node, so
  // wiring two Start nodes (or a Start node and a Multimodal Input entry
  // point) to the same target must still emit only one add_edge(START, ...).
  const wiredStartTargets = new Set<string>()
  const wireStart = (targetName: string | undefined) => {
    if (!targetName || wiredStartTargets.has(targetName)) return
    wiredStartTargets.add(targetName)
    emit(`builder.add_edge(START, "${targetName}")`)
  }

  for (const start of startNodes) {
    for (const edge of wiredEdges.filter(
      (e) => e.source === start.id && graphIds.has(e.target),
    )) {
      wireStart(names.get(edge.target))
    }
  }

  // Multimodal Input nodes can replace the Start node. When one has no
  // incoming graph edge it is an entry point, so wire START straight into it.
  for (const node of orderedNodes.filter((n) => n.type === 'multimodalInput')) {
    const hasIncoming = wiredEdges.some(
      (e) => e.target === node.id && graphIds.has(e.source),
    )
    if (!hasIncoming) {
      wireStart(names.get(node.id))
    }
  }

  // Nodes with multiple outgoing edges get conditional routing; the rest
  // get plain edges. Condition routers were emitted above, so generate
  // generic routers for other fan-outs.
  // Routers and guardrails emit their route_ function in the node switch
  // above (with real bodies); condition keeps its existing one. The rest get
  // a generic TODO router only when they fan out.
  const routedTypes: AgentFlowNodeType[] = [
    'condition',
    'router',
    'guardrail',
    'evaluator',
    'tryCatch',
  ]
  for (const node of orderedNodes) {
    const name = names.get(node.id)
    if (!name) continue
    const outs = outgoing(node.id)
    if (outs.length === 0) continue
    const targets = outs
      .map((e) => names.get(e.target))
      .filter((t): t is string => t !== undefined)
    // Map wires through a conditional edge whose router returns a list of
    // Send objects — list of target node names, no label mapping.
    if (node.type === 'map') {
      const targetList = targets.map((t) => `"${t}"`).join(', ')
      emit(`builder.add_conditional_edges("${name}", route_${name}, [${targetList}])`)
      continue
    }
    // Guardrails and Try/Catch always route (even with a single labeled edge).
    const singlePlainEdge =
      outs.length === 1 && node.type !== 'guardrail' && node.type !== 'tryCatch'
    if (singlePlainEdge) {
      emit(`builder.add_edge("${name}", "${targets[0]}")`)
    } else if (node.type && routedTypes.includes(node.type)) {
      const guard = guardrailTargets.get(node.id)
      const tryCatch = tryCatchTargets.get(node.id)
      let mapping: string
      if (guard) {
        mapping = `"pass": "${guard.pass}", "fail": "${guard.fail}"`
      } else if (tryCatch) {
        mapping = `"success": "${tryCatch.onSuccess}", "error": "${tryCatch.onError}"`
      } else if (node.type === 'evaluator') {
        // Map each evaluator branch to the node its labeled edge points at.
        const branches = (node.data.evalBranches ?? ['pass', 'fail']).filter(
          Boolean,
        )
        const pairs: string[] = []
        for (const b of branches) {
          const edgeForBranch = outs.find(
            (e) =>
              (typeof e.label === 'string' && e.label !== ''
                ? e.label
                : (names.get(e.target) ?? '')) === b,
          )
          const target = edgeForBranch ? names.get(edgeForBranch.target) : undefined
          pairs.push(`"${b}": "${target ?? targets[0] ?? 'END'}"`)
        }
        mapping = pairs.join(', ')
      } else {
        mapping = targets.map((t) => `"${t}": "${t}"`).join(', ')
      }
      emit(`builder.add_conditional_edges("${name}", route_${name}, {${mapping}})`)
    } else {
      // Plain node fanning out to several targets: parallel edges. LangGraph
      // runs them as one superstep — branching is explicit via Router/Condition,
      // so an unrouted fan-out is genuine parallelism (e.g. into a Join).
      for (const target of targets) {
        emit(`builder.add_edge("${name}", "${target}")`)
      }
    }
  }

  for (const node of orderedNodes.filter((n) => n.type === 'output')) {
    emit(`builder.add_edge("${names.get(node.id)}", END)`)
  }
  emit('')

  for (const node of vectorStoreNodes) {
    // A vector store is the Retriever's backing store, not a graph concern.
    emit(
      `# Vector store "${pyDoc(node.data.label)}" — wire it into the Retriever`,
      '# node above (e.g. Chroma/FAISS .as_retriever()), not the graph compile.',
    )
  }
  if (hasCheckpointer) {
    const kinds = checkpointerNodes
      .map((n) => n.data.memoryType ?? 'short-term')
      .join(', ')
    emit(`# Memory nodes on canvas: ${kinds}`)
    emit('checkpointer = MemorySaver()')
  }
  if (hasStore) {
    emit('# Long-Term Store (cross-thread, namespaced memory)')
    emit('store = InMemoryStore()')
  }
  const compileArgs: string[] = []
  if (hasCheckpointer) compileArgs.push('checkpointer=checkpointer')
  if (hasStore) compileArgs.push('store=store')
  if (hilNames.length > 0) {
    compileArgs.push(
      `interrupt_before=[${hilNames.map((n) => `"${n}"`).join(', ')}]`,
    )
  }
  emit(`graph = builder.compile(${compileArgs.join(', ')})`)
  emit('')

  const needsConfig = hasCheckpointer || hilNames.length > 0
  const initialState =
    '{"messages": [{"role": "user", "content": "Hello!"}]' +
    fields.map((f) => `, "${f}": ""`).join('') +
    [...mapSources].map((src) => `, "${src}": []`).join('') +
    (hasPlanner && !mapSources.has('todos') ? ', "todos": []' : '') +
    '}'

  const emitEnvGuards = () => {
    for (const envVar of envVars) {
      emit(`    if not os.environ.get("${envVar}"):`)
      emit(
        `        raise SystemExit("${envVar} is not set — add it to your .env file.")`,
      )
    }
  }

  if (options.asyncMode) {
    emit('async def main() -> None:')
    emitEnvGuards()
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
    emitEnvGuards()
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

  return HEADER + '\n' + lines.join('\n')
}
