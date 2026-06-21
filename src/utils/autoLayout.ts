import dagre from 'dagre'
import type { AgentFlowEdge, AgentFlowNode } from '../types'

export type LayoutDirection = 'TB' | 'LR'

/** Fallback node footprint when a node hasn't been measured yet (w-52 card). */
const FALLBACK_WIDTH = 208
const FALLBACK_HEIGHT = 80

/**
 * Arranges nodes into a clean DAG using dagre. Returns a new nodes array with
 * updated `position`; edges are returned unchanged for caller convenience.
 * dagre reports node centers, so we convert back to React Flow's top-left
 * origin. Pure — does not touch the store or the live viewport.
 */
export function getLayoutedElements(
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
  direction: LayoutDirection = 'TB',
): { nodes: AgentFlowNode[]; edges: AgentFlowEdge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 })

  const dims = new Map<string, { width: number; height: number }>()
  for (const node of nodes) {
    const width = node.width ?? node.measured?.width ?? FALLBACK_WIDTH
    const height = node.height ?? node.measured?.height ?? FALLBACK_HEIGHT
    dims.set(node.id, { width, height })
    g.setNode(node.id, { width, height })
  }
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node
    const { width, height } = dims.get(node.id) ?? {
      width: FALLBACK_WIDTH,
      height: FALLBACK_HEIGHT,
    }
    return {
      ...node,
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
    }
  })

  return { nodes: layoutedNodes, edges }
}
