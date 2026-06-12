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
  | 'loop'
  | 'humanInLoop'
  | 'supervisor'
  | 'swarmWorker'
  | 'retriever'
  | 'mcpServer'
  | 'structuredOutput'
  | 'note'
  | 'group'

export type LLMModel =
  | 'gemini-flash'
  | 'gemini-pro'
  | 'ollama/llama3'
  | 'ollama/mistral'

export type MemoryType = 'short-term' | 'vector-store' | 'checkpointer'

/**
 * Flat data shape shared by every node type. Type-specific fields are
 * optional; default factories in utils/nodeDefaults.ts fill in the ones
 * each node type actually uses.
 */
export type AgentFlowNodeData = {
  label: string
  /** Start */
  inputVariables?: string[]
  /** LLM */
  model?: LLMModel
  systemPrompt?: string
  temperature?: number
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
  /** Loop */
  loopCondition?: string
  /** Retriever */
  knowledgeBase?: string
  topK?: number
  similarityThreshold?: number
  /** MCP Server */
  serverUrl?: string
  mcpTools?: string[]
  /** Structured Output */
  pydanticModel?: string
  jsonSchema?: string
  /** Note */
  text?: string
  /** Appearance overrides (any node) */
  color?: string
  icon?: string
  /** Group frame */
  collapsed?: boolean
  expandedWidth?: number
  expandedHeight?: number
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
  status: 'ok' | 'error' | 'skipped'
  /** Absent for skipped entries (the node never executed). */
  engine?: ExecutionEngine
  durationMs: number
  input: string
  output: string
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
}
