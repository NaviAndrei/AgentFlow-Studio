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

/** F16 — demo-mode workspace roles (UI-only RBAC; backend auth is a V2 feature). */
export type WorkspaceRole = 'viewer' | 'editor' | 'deployer' | 'admin'

export type PermissionAction =
  | 'deleteNode'
  | 'clearCanvas'
  | 'saveBlueprint'
  | 'startRun'
  | 'manageTriggers'
  | 'exportFlow'
  | 'changeSettings'
  | 'switchRole'

export const ROLE_PERMISSIONS: Record<WorkspaceRole, PermissionAction[]> = {
  viewer: [],
  editor: ['deleteNode', 'saveBlueprint', 'exportFlow'],
  deployer: ['deleteNode', 'saveBlueprint', 'exportFlow', 'startRun', 'manageTriggers'],
  admin: [
    'deleteNode',
    'clearCanvas',
    'saveBlueprint',
    'startRun',
    'manageTriggers',
    'exportFlow',
    'changeSettings',
    'switchRole',
  ],
}

/** F15 — A2A (Agent-to-Agent) remote agent node config. */
export interface A2AAgentConfig {
  agentUrl: string
  skillId?: string
  authToken?: string
  pollIntervalMs?: number
  maxPollAttempts?: number
}

export interface A2AAgentCard {
  name: string
  description?: string
  skills: Array<{ id: string; name: string }>
}

/** A registered MCP server entry in the mcpStore registry. */
export interface MCPServerConfig {
  serverKey: string
  label: string
  endpointUrl: string
  authToken?: string
  description?: string
  /** Runtime-only — not persisted to localStorage. */
  isConnected?: boolean
}

/** A tool advertised by an MCP server's `tools/list` response. */
export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/** One stored memory entry with a hash-based sparse embedding (no ML dependency). */
export interface VectorEntry {
  id: string
  text: string
  embedding: number[]
  metadata?: Record<string, unknown>
  createdAt: number
}

/** A scored match returned by vectorMemory's semanticSearch. */
export interface MemorySearchResult {
  entry: VectorEntry
  score: number
}

/** One row of an imported dataset, scored after a Dataset Runner pass. */
export interface EvalRow {
  id: string
  input: string
  expectedOutput: string
  actualOutput?: string
  score?: number
  scoreMethod?: 'exact' | 'pending'
  error?: string
}

/** An imported CSV/JSON dataset for the Dataset Runner. */
export interface EvalDataset {
  id: string
  name: string
  rows: EvalRow[]
  createdAt: number
}

/** One completed pass of a dataset through the current flow. */
export interface EvalDatasetRun {
  id: string
  datasetId: string
  startedAt: number
  completedAt?: number
  results: EvalRow[]
  averageScore?: number
}

export type TriggerMode = 'webhook' | 'schedule'

/** Arming state for a triggerStore-managed trigger, keyed by node id. */
export interface TriggerConfig {
  mode: TriggerMode
  webhookId?: string
  webhookSecret?: string
  intervalMs?: number
  isArmed: boolean
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
  /** Per-node provider id override; empty/absent = use the global provider. */
  providerOverride?: string
  /** Agent */
  tools?: string[]
  maxIterations?: number
  /** Tool */
  toolName?: string
  description?: string
  inputSchema?: string
  outputSchema?: string
  /** Tool — HTTP endpoint dispatch (falls back to LLM-only when unset). */
  endpointUrl?: string
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
  /** Key into mcpStore.servers — resolves endpointUrl/authToken at runtime. */
  serverKey?: string
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
  /** F18 — explicit script to run; when empty the node runs upstream-generated code. */
  code?: string
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
  /** F15 — structured A2A config + cached discovery card. */
  a2aConfig?: A2AAgentConfig
  a2aAgentCard?: A2AAgentCard
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

/**
 * Lightweight summary of one completed execution run, recorded by evalStore
 * when a run finishes (distinct from EvalRun, which scores test cases). Powers
 * the read-only "Last run: X nodes, Y errors, Zms" row beneath the toolbar.
 */
export interface LastRunSummary {
  runId: string
  /** Epoch ms when the run finished. */
  timestamp: number
  /** Total node executions in the run (excludes skipped branches). */
  nodesExecuted: number
  /** Nodes that finished with error status. */
  errorCount: number
  /** Wall-clock latency of the run, in ms. */
  totalLatencyMs: number
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

/** One node execution's timing/cost capture, recorded for the Span Timeline. */
export interface RunSpan {
  spanId: string
  nodeId: string
  nodeName: string
  nodeType: string
  startTime: number
  endTime: number
  durationMs: number
  status: 'ok' | 'error'
  tokensIn: number
  tokensOut: number
  costUsd: number
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

/**
 * Per-node execution span captured by the live simulation walker.
 * Richer than TraceEntry: records wall-clock timing, token split, and cost
 * so the SpanTimeline component can render proportional latency bars and
 * MetricsBar can surface last-node latency without re-scanning the trace.
 */
export interface RunSpan {
  /** crypto.randomUUID() generated before the node's switch/case runs. */
  spanId: string
  /** The canvas node id that was executed. */
  nodeId: string
  nodeName: string
  nodeType: string
  /** Epoch ms — captured with Date.now() before the switch/case. */
  startTime: number
  /** Epoch ms — captured in the finally block after execution. */
  endTime: number
  /** endTime - startTime */
  durationMs: number
  /** Estimated input tokens (from estimateTokens helper, or 0 for non-LLM nodes). */
  tokensIn: number
  /** Estimated output tokens. */
  tokensOut: number
  /** Estimated USD cost for this node's execution. */
  costUsd: number
  /** 'ok' unless an exception was thrown during execution. */
  status: 'ok' | 'error'
  /** Present only when status === 'error'. */
  errorMessage?: string
}

/**
 * Full ordered list of RunSpans for a single completed run.
 * Used as the export envelope for exportRunTrace() — downloaded as JSON,
 * no server required.
 */
export interface RunTrace {
  runId: string
  /** Epoch ms when the export was triggered. */
  exportedAt: number
  spans: RunSpan[]
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
  /**
   * Per-node execution spans for this run.
   * Optional for backward compatibility — RunRecords persisted before this
   * field was introduced simply have undefined here; SpanTimeline renders
   * nothing in that case.
   */
  spanLog?: RunSpan[]
}
