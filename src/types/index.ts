import type { Edge, Node } from '@xyflow/react'

export type NodeCategory = 'core' | 'flow' | 'multiagent' | 'annotation'

export type AgentFlowNodeType =
  | 'start'
  | 'llm'
  | 'agent'
  | 'tool'
  | 'memory'
  | 'output'
  | 'condition'
  | 'router'
  | 'guardrail'
  | 'join'
  | 'loop'
  | 'humanInLoop'
  | 'supervisor'
  | 'swarmWorker'
  | 'retriever'
  | 'mcpServer'
  | 'structuredOutput'
  | 'map'
  | 'codeExecutor'
  | 'evaluator'
  | 'subgraph'
  | 'longTermStore'
  | 'memoryWriter'
  | 'planner'
  | 'subagent'
  | 'computerUse'
  | 'a2aAgent'
  | 'multimodalInput'
  | 'tryCatch'
  | 'retry'
  | 'httpRequest'
  | 'note'
  | 'group'

export type MemoryType = 'short-term' | 'vector-store' | 'checkpointer'

/** A tool advertised by an MCP server's `tools/list` response. */
export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * Flat data shape shared by every node type. Type-specific fields are
 * optional; default factories in utils/nodeDefaults.ts fill in the ones
 * each node type actually uses.
 */
export type AgentFlowNodeData = {
  label: string
  /** Start */
  inputVariables?: string[]
  /** LLM — free-text model id; legacy tier ids resolve via exportModels aliases. */
  model?: string
  /** Live-mode model override; empty/absent = use the global LLM setting. */
  modelOverride?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  /** Agent */
  tools?: string[]
  maxIterations?: number
  /** Tool */
  toolName?: string
  description?: string
  inputSchema?: string
  outputSchema?: string
  /** Memory */
  memoryType?: MemoryType
  /** Condition */
  branches?: string[]
  /** Router — route names become named output handles + edge labels. */
  routes?: string[]
  routingPrompt?: string
  /** Guardrail */
  checkType?: 'keyword' | 'llm-judge'
  criteria?: string
  /** Join — how the waited-on branch outputs are merged. */
  mergeStrategy?: 'concat' | 'last'
  /** Loop */
  loopCondition?: string
  /** Retriever */
  knowledgeBase?: string
  topK?: number
  similarityThreshold?: number
  /** MCP Server */
  serverUrl?: string
  mcpTools?: string[]
  discoveredTools?: MCPTool[]
  selectedTools?: string[]
  /** Structured Output */
  pydanticModel?: string
  jsonSchema?: string
  /** Map (Send) — dynamic runtime fan-out over a list in state. */
  inputExpression?: string
  maxParallel?: number
  /**
   * Simulation-only fan-out config: explicit item list (one virtual branch
   * per item). When empty/absent, the simulator falls back to mapCount and
   * synthesizes generic items. Live/exported runtime still uses inputExpression.
   */
  mapItems?: string[]
  /** Simulation-only branch count when mapItems is empty. Default 3. */
  mapCount?: number
  /** Code Executor — sandboxed REPL for generated code. */
  language?: 'python' | 'javascript' | 'bash'
  timeout?: number
  allowNetworkAccess?: boolean
  /** Evaluator — LLM-as-judge that scores and routes. */
  scoringPrompt?: string
  scoreType?: 'pass_fail' | 'numeric' | 'letter_grade'
  threshold?: number
  evalBranches?: string[]
  /** Subgraph — references another saved canvas, executed as a single node. */
  subgraphRef?: string
  subgraphSummary?: string
  inputMapping?: string
  outputMapping?: string
  /** Simulation-only: append a summary of the inner run to the parent transcript. */
  appendToParent?: boolean
  /** Long-Term Store — namespaced cross-thread memory (BaseStore). */
  namespace?: string
  storeOperation?: 'read' | 'write' | 'search'
  searchQuery?: string
  /** Memory Writer — LangMem background extractor. */
  memoryKind?: 'episodic' | 'semantic' | 'procedural'
  extractionPrompt?: string
  writeNamespace?: string
  /** Planner — Deep-Agents-style task decomposition (write_todos). */
  decompositionPrompt?: string
  maxTasks?: number
  /** Subagent — isolated-context delegate. */
  taskInput?: string
  role?: string
  /** Computer-Use — screenshot→action→screenshot browser-automation loop. */
  task?: string
  maxSteps?: number
  allowedTools?: string[]
  /** HTTP Request — make GET/POST/PUT/DELETE/PATCH calls. */
  httpUrl?: string
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  httpHeaders?: string
  httpBody?: string
  httpTimeoutMs?: number
  /** A2A Remote Agent — call an external agent over the A2A protocol. */
  agentUrl?: string
  agentName?: string
  taskDescription?: string
  authToken?: string
  timeoutSeconds?: number
  /** Multimodal Input — image/audio/document entry for vision-capable LLMs. */
  inputType?: 'image' | 'audio' | 'document' | 'mixed'
  inputVariable?: string
  textPrompt?: string
  encoding?: 'base64' | 'url'
  /** Try/Catch — guards the onSuccess subgraph; errors route to onError. */
  tryCatch?: {
    catchErrors: ('timeout' | 'rate_limit' | 'network' | 'any')[]
    fallbackOutput: string
  }
  /** Retry — wraps the single downstream node with retry + backoff. */
  retry?: {
    maxAttempts: number
    backoffMs: number
    backoffMultiplier: number
    retryOn: ('error' | 'empty_output' | 'any')[]
  }
  /** Note */
  text?: string
  /** Appearance overrides (any node) */
  color?: string
  icon?: string
  /** Group frame */
  collapsed?: boolean
  expandedWidth?: number
  expandedHeight?: number
  /** Prompt Registry — references a PromptEntry.id; overrides inline systemPrompt at runtime/export when set. */
  systemPromptRef?: string
}

export type AgentFlowNode = Node<AgentFlowNodeData, AgentFlowNodeType>

export type EdgeKind = 'direct' | 'conditional' | 'bidirectional'

export type AgentFlowEdge = Edge<{ edgeType?: EdgeKind }>

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Which execution engine produced a node's result. */
export type ExecutionEngine = 'live' | 'simulated'

export interface TraceEntry {
  id: string
  /** Epoch ms when the node finished executing. */
  at: number
  nodeId: string
  nodeName: string
  nodeType: string
  status: 'ok' | 'error' | 'skipped' | 'cached'
  /** Absent for skipped entries (the node never executed). */
  engine?: ExecutionEngine
  durationMs: number
  input: string
  output: string
  /** Set on trace entries produced by a Subgraph node's inner sub-walker. */
  parentNodeId?: string
}

/**
 * T2-2: A full state capture for one executed node, in execution order.
 * Powers the Time-Travel Debugger — unlike TraceEntry (truncated strings),
 * a snapshot keeps the untruncated input/output state for step-by-step replay.
 */
export interface StepSnapshot {
  /** 0-based position in execution order. */
  stepIndex: number
  nodeId: string
  nodeName: string
  nodeType: string
  /** State entering the node: its config + upstream outputs + run-level knobs. */
  inputState: Record<string, unknown>
  /** Full, untruncated output the node produced. */
  outputState: unknown
  /** Chat transcript immediately after this step finished — lets "Fork from
   *  Here" restore the exact conversational state a forked run should resume from. */
  messagesState?: ChatMessage[]
  /** Epoch ms when the node finished. */
  at: number
  durationMs: number
  status: 'ok' | 'error' | 'skipped' | 'cached'
}

export type ValidationLevel = 'error' | 'warning'

export interface ValidationIssue {
  /** Absent for graph-level issues (e.g. missing Start node). */
  nodeId?: string
  level: ValidationLevel
  message: string
}

export interface BlueprintNode {
  id: string
  type: AgentFlowNodeType
  position: { x: number; y: number }
  data: AgentFlowNodeData
}

export interface BlueprintEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface Blueprint {
  id: string
  name: string
  description: string
  /** Format version; absent in early blueprints, treated as 1. */
  schemaVersion?: number
  /** Gallery tag, e.g. "Multi-Agent" or "Quality Loop". */
  category?: string
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
}

/**
 * Serialized canvas file format (Save/Open). Richer than Blueprint: it
 * round-trips group frames (parentId, explicit size, hidden children) and
 * edge kinds so a saved canvas restores exactly.
 */
export interface CanvasDocumentNode {
  id: string
  type: AgentFlowNodeType
  position: { x: number; y: number }
  data: AgentFlowNodeData
  parentId?: string
  width?: number
  height?: number
  hidden?: boolean
}

export interface CanvasDocumentEdge {
  id: string
  source: string
  target: string
  label?: string
  edgeKind?: EdgeKind
  hidden?: boolean
}

export interface CanvasDocument {
  schemaVersion: number
  nodes: CanvasDocumentNode[]
  edges: CanvasDocumentEdge[]
  /** Pan/zoom state at save time; absent for documents saved before this field existed. */
  viewport?: { x: number; y: number; zoom: number }
}

export interface EvalTestCase {
  id: string
  input: string
  expectedOutput: string
  description?: string
}

export interface EvalResult {
  testCaseId: string
  status: 'pass' | 'partial' | 'fail' | 'pending'
  actualOutput: string
  score: number
}

export interface EvalRun {
  id: string
  runAt: number
  results: EvalResult[]
  qualityScore: number
}

export interface NodeCostEntry {
  nodeId: string
  nodeName: string
  nodeType: string
  tokensIn: number
  tokensOut: number
  estimatedCostUsd: number
}

export interface RunCostSummary {
  entries: NodeCostEntry[]
  totalTokens: number
  totalCostUsd: number
  model: string
}

/** A single saved version of a prompt's text. */
export interface PromptVersion {
  id: string
  content: string
  createdAt: number
  note?: string
}

/** A named, versioned prompt template referenced by nodes via *Ref fields. */
export interface PromptEntry {
  id: string
  name: string
  category: 'system' | 'user' | 'general'
  /** Newest last. */
  versions: PromptVersion[]
  /** Which version is "active"; defaults to the latest. */
  pinnedVersionId: string
}

/** A snapshot of one completed/stopped simulation run, kept in Run History. */
export interface RunRecord {
  id: string
  startedAt: number
  finishedAt: number
  durationMs: number
  mode: 'simulated' | 'live'
  status: 'done' | 'error' | 'stopped'
  nodeCount: number
  stepCount: number
  totalTokens: number
  totalCostUsd: number
  model: string
  /** null if there were no eval test cases for this run. */
  qualityScore: number | null
  evalPassCount: number | null
  evalTotalCount: number | null
  traceSnapshot: TraceEntry[]
  /** T2-2: per-step state captures for the Time-Travel Debugger. */
  snapshots: StepSnapshot[]
  costSnapshot: RunCostSummary | null
}
