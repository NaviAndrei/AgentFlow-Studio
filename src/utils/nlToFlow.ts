import type { AgentFlowEdge, AgentFlowNode, AgentFlowNodeType } from '../types'
import { callLLMDirect } from './callLLMDirect'

export function buildNLFlowSystemPrompt(
  registeredNodeTypes: AgentFlowNodeType[],
): string {
  return `You generate AgentFlow Studio node graphs from descriptions.
Respond ONLY with valid JSON. No markdown, no explanation, no code fences.
VALID NODE TYPES (use ONLY these exact strings): ${registeredNodeTypes.join(', ')}
JSON Schema:
{ nodes: [{ id: string, type: <one of valid types>, data: { label: string, systemPrompt?: string }, position: { x: number, y: number } }],
  edges: [{ id: string, source: string, target: string }] }
Position nodes in a left-to-right flow: first node at x:100, y:300, each subsequent node +250px on x.
Generate IDs as 'node-1', 'node-2', etc.`
}

interface RawNode {
  id?: unknown
  type?: unknown
  data?: { label?: unknown; systemPrompt?: unknown }
  position?: { x?: unknown; y?: unknown }
}
interface RawEdge {
  id?: unknown
  source?: unknown
  target?: unknown
}

/**
 * Parse + harden an LLM-produced graph: unknown node types become 'unknown'
 * (catching anything the schema-constrained prompt failed to constrain), and
 * edges referencing missing nodes are dropped. Never throws.
 */
export function validateAndSanitizeFlowJSON(
  raw: unknown,
  registeredNodeTypes: AgentFlowNodeType[],
): { nodes: AgentFlowNode[]; edges: AgentFlowEdge[]; warnings: string[] } {
  const warnings: string[] = []

  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { nodes: [], edges: [], warnings: ['Parse error: response was not valid JSON'] }
    }
  }

  const obj = parsed as { nodes?: unknown; edges?: unknown }
  const rawNodes = Array.isArray(obj?.nodes) ? (obj.nodes as RawNode[]) : []
  const rawEdges = Array.isArray(obj?.edges) ? (obj.edges as RawEdge[]) : []
  const validTypes = new Set<string>(registeredNodeTypes)

  const nodes: AgentFlowNode[] = []
  rawNodes.forEach((n, i) => {
    const id = typeof n.id === 'string' ? n.id : `node-${i + 1}`
    const rawType = typeof n.type === 'string' ? n.type : 'unknown'
    let type = rawType
    if (!validTypes.has(rawType)) {
      type = 'unknown'
      warnings.push(`Unknown node type "${rawType}" replaced with "unknown"`)
    }
    const label =
      typeof n.data?.label === 'string' && n.data.label ? n.data.label : id
    const systemPrompt =
      typeof n.data?.systemPrompt === 'string' ? n.data.systemPrompt : undefined
    const x = typeof n.position?.x === 'number' ? n.position.x : 100 + i * 250
    const y = typeof n.position?.y === 'number' ? n.position.y : 300
    nodes.push({
      id,
      type: type as AgentFlowNodeType,
      position: { x, y },
      data: { label, ...(systemPrompt ? { systemPrompt } : {}) },
    })
  })

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: AgentFlowEdge[] = []
  rawEdges.forEach((e, i) => {
    const source = typeof e.source === 'string' ? e.source : ''
    const target = typeof e.target === 'string' ? e.target : ''
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      warnings.push(`Edge ${source || '?'}→${target || '?'} references a missing node — removed`)
      return
    }
    edges.push({
      id: typeof e.id === 'string' ? e.id : `edge-${i + 1}`,
      source,
      target,
      type: 'agentflow',
    })
  })

  return { nodes, edges, warnings }
}

export async function descriptionToFlow(
  registeredNodeTypes: AgentFlowNodeType[],
  description: string,
  refinementHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{
  nodes: AgentFlowNode[]
  edges: AgentFlowEdge[]
  warnings: string[]
  error?: string
}> {
  const systemPrompt = buildNLFlowSystemPrompt(registeredNodeTypes)
  // Prior exchange is prepended to the description so the model refines the
  // existing graph rather than starting over.
  const priorContext =
    refinementHistory && refinementHistory.length > 0
      ? refinementHistory.map((m) => `${m.role}: ${m.content}`).join('\n') + '\n\n'
      : ''
  const result = await callLLMDirect(systemPrompt, priorContext + description)
  if (result.error) {
    return { nodes: [], edges: [], warnings: [], error: result.error }
  }
  const sanitized = validateAndSanitizeFlowJSON(result.text, registeredNodeTypes)
  return { ...sanitized }
}
