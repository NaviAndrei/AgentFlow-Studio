/**
 * Runtime validation for graph JSON entering the app from outside the type
 * system: bundled blueprint files and user-imported canvas documents. One
 * choke point so malformed data fails with a clear message instead of
 * crashing deep inside React Flow.
 */
import { NODE_META } from '../nodes/registry'
import type {
  AgentFlowNodeData,
  AgentFlowNodeType,
  Blueprint,
  CanvasDocument,
  CanvasDocumentEdge,
  CanvasDocumentNode,
  EdgeKind,
} from '../types'

export const CANVAS_SCHEMA_VERSION = 1

const EDGE_KINDS: EdgeKind[] = ['direct', 'conditional', 'bidirectional']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNodeType(value: unknown): value is AgentFlowNodeType {
  return typeof value === 'string' && value in NODE_META
}

function isPosition(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  )
}

function parseNode(raw: unknown): CanvasDocumentNode | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || raw.id === '') return null
  if (!isNodeType(raw.type)) return null
  if (!isPosition(raw.position)) return null
  if (!isRecord(raw.data) || typeof raw.data.label !== 'string') return null
  const node: CanvasDocumentNode = {
    id: raw.id,
    type: raw.type,
    position: { x: raw.position.x, y: raw.position.y },
    // The label was checked above; remaining fields are optional and the
    // renderers fall back per-field, so a partial data object is safe.
    data: raw.data as AgentFlowNodeData,
  }
  if (typeof raw.parentId === 'string') node.parentId = raw.parentId
  if (typeof raw.width === 'number') node.width = raw.width
  if (typeof raw.height === 'number') node.height = raw.height
  if (typeof raw.hidden === 'boolean') node.hidden = raw.hidden
  return node
}

function parseEdge(
  raw: unknown,
  nodeIds: Set<string>,
): CanvasDocumentEdge | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || raw.id === '') return null
  if (typeof raw.source !== 'string' || !nodeIds.has(raw.source)) return null
  if (typeof raw.target !== 'string' || !nodeIds.has(raw.target)) return null
  const edge: CanvasDocumentEdge = {
    id: raw.id,
    source: raw.source,
    target: raw.target,
  }
  if (typeof raw.label === 'string') edge.label = raw.label
  if (EDGE_KINDS.includes(raw.edgeKind as EdgeKind)) {
    edge.edgeKind = raw.edgeKind as EdgeKind
  }
  if (typeof raw.hidden === 'boolean') edge.hidden = raw.hidden
  return edge
}

function parseGraph(
  rawNodes: unknown,
  rawEdges: unknown,
): { nodes: CanvasDocumentNode[]; edges: CanvasDocumentEdge[] } | null {
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) return null
  const nodes: CanvasDocumentNode[] = []
  for (const raw of rawNodes) {
    const node = parseNode(raw)
    if (!node) return null
    nodes.push(node)
  }
  const nodeIds = new Set(nodes.map((n) => n.id))
  // Children must reference an existing parent frame.
  for (const node of nodes) {
    if (node.parentId !== undefined && !nodeIds.has(node.parentId)) return null
  }
  const edges: CanvasDocumentEdge[] = []
  for (const raw of rawEdges) {
    const edge = parseEdge(raw, nodeIds)
    if (!edge) return null
    edges.push(edge)
  }
  return { nodes, edges }
}

/** Validate an imported canvas document; null (with a warning) if invalid. */
export function parseCanvasDocument(raw: unknown): CanvasDocument | null {
  if (!isRecord(raw)) {
    console.warn('Canvas import rejected: not a JSON object')
    return null
  }
  const version =
    typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1
  if (version > CANVAS_SCHEMA_VERSION) {
    console.warn(`Canvas import rejected: unknown schemaVersion ${version}`)
    return null
  }
  const graph = parseGraph(raw.nodes, raw.edges)
  if (!graph) {
    console.warn('Canvas import rejected: malformed nodes or edges')
    return null
  }
  return { schemaVersion: version, ...graph }
}

/** Validate a bundled blueprint; null (with a warning) if invalid. */
export function parseBlueprint(raw: unknown): Blueprint | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.description !== 'string'
  ) {
    console.warn('Blueprint rejected: missing id/name/description')
    return null
  }
  const graph = parseGraph(raw.nodes, raw.edges)
  if (!graph) {
    console.warn(`Blueprint "${raw.id}" rejected: malformed nodes or edges`)
    return null
  }
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    schemaVersion:
      typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
    category: typeof raw.category === 'string' ? raw.category : undefined,
    nodes: graph.nodes,
    edges: graph.edges,
  }
}
