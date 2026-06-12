import type { AgentFlowEdge, AgentFlowNode, ValidationIssue } from '../types'

/** Node types that participate in execution flow (notes are annotations). */
const NON_FLOW_TYPES = ['note', 'group']

export function validateGraph(
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
): ValidationIssue[] {
  if (nodes.length === 0) return []

  const issues: ValidationIssue[] = []
  const flowNodes = nodes.filter(
    (n) => n.type !== undefined && !NON_FLOW_TYPES.includes(n.type),
  )
  const hasOutgoing = (id: string) => edges.some((e) => e.source === id)

  if (!flowNodes.some((n) => n.type === 'start')) {
    issues.push({ level: 'error', message: 'Canvas has no Start node' })
  }

  for (const node of flowNodes) {
    if (node.type === 'llm' && !node.data.model) {
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: 'LLM node has no model selected',
      })
    }
    if (node.type === 'tool' && (node.data.toolName ?? '').trim() === '') {
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: 'Tool node has no name',
      })
    }
    if (node.type === 'start' && !hasOutgoing(node.id)) {
      issues.push({
        nodeId: node.id,
        level: 'error',
        message: 'Start node has no outgoing edge',
      })
    } else if (
      node.type !== 'output' &&
      node.type !== 'start' &&
      !hasOutgoing(node.id)
    ) {
      issues.push({
        nodeId: node.id,
        level: 'warning',
        message: 'Node has no outgoing edge',
      })
    }
  }

  return issues
}
