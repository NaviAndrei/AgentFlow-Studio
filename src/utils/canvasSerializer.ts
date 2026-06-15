/**
 * Save/Open support: converts the live canvas to a versioned JSON document
 * and back. Group frames (parentId, explicit size, hidden children) and
 * edge kinds round-trip exactly.
 */
import type {
  AgentFlowEdge,
  AgentFlowNode,
  CanvasDocument,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '../types'
import { CANVAS_SCHEMA_VERSION, parseCanvasDocument } from './blueprintSchema'
import { markersForKind } from './edgeKinds'

export function serializeCanvas(
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
): CanvasDocument {
  const docNodes: CanvasDocumentNode[] = nodes
    .filter((n): n is AgentFlowNode & { type: NonNullable<AgentFlowNode['type']> } =>
      n.type !== undefined,
    )
    .map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      data: n.data,
      ...(n.parentId !== undefined && { parentId: n.parentId }),
      ...(n.width !== undefined && { width: n.width }),
      ...(n.height !== undefined && { height: n.height }),
      ...(n.hidden === true && { hidden: true }),
    }))
  const docEdges: CanvasDocumentEdge[] = edges.map((e) => {
    const kind = e.data?.edgeType ?? 'direct'
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      ...(typeof e.label === 'string' && e.label !== '' && { label: e.label }),
      ...(kind !== 'direct' && { edgeKind: kind }),
      ...(e.hidden === true && { hidden: true }),
    }
  })
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    nodes: docNodes,
    edges: docEdges,
  }
}

export function deserializeCanvas(doc: CanvasDocument): {
  nodes: AgentFlowNode[]
  edges: AgentFlowEdge[]
} {
  const nodes: AgentFlowNode[] = doc.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    ...(n.parentId !== undefined && { parentId: n.parentId }),
    ...(n.width !== undefined && { width: n.width }),
    ...(n.height !== undefined && { height: n.height }),
    ...(n.hidden === true && { hidden: true }),
  }))
  const edges: AgentFlowEdge[] = doc.edges.map((e) => {
    const kind = e.edgeKind ?? 'direct'
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'agentflow',
      animated: true,
      ...(e.label !== undefined && { label: e.label }),
      ...(kind !== 'direct' && { data: { edgeType: kind } }),
      ...markersForKind(kind),
      ...(e.hidden === true && { hidden: true }),
    }
  })
  return { nodes, edges }
}

/** Trigger a browser download of the current canvas as a .json file. */
export function downloadCanvas(nodes: AgentFlowNode[], edges: AgentFlowEdge[]): void {
  const doc = serializeCanvas(nodes, edges)
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `agentflow-canvas-${stamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Parse a raw canvas JSON string (e.g. from a drag-and-drop file read).
 * Rejects with a plain string message, suitable for a toast/notification.
 */
export function parseCanvas(raw: string): {
  nodes: AgentFlowNode[]
  edges: AgentFlowEdge[]
} {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw 'Not a valid JSON file'
  }
  const doc = parseCanvasDocument(json)
  if (!doc) {
    throw 'Not a valid AgentFlow canvas file'
  }
  return deserializeCanvas(doc)
}

/** Read and validate a user-provided canvas file; rejects with a message. */
export async function readCanvasFile(file: File): Promise<CanvasDocument> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new Error('Not a valid JSON file')
  }
  const doc = parseCanvasDocument(raw)
  if (!doc) {
    throw new Error('Not a valid AgentFlow canvas file')
  }
  return doc
}
