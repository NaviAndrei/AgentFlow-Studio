import { create } from 'zustand'
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import type {
  Connection,
  Edge,
  EdgeChange,
  NodeChange,
  XYPosition,
} from '@xyflow/react'
import type {
  AgentFlowNode,
  AgentFlowNodeData,
  AgentFlowNodeType,
  EdgeKind,
  ValidationIssue,
} from '../types'
import { markersForKind } from '../utils/edgeKinds'
import { createDefaultNodeData } from '../utils/nodeDefaults'
import { validateGraph } from '../utils/validation'

interface Snapshot {
  nodes: AgentFlowNode[]
  edges: Edge[]
}

interface CanvasState {
  nodes: AgentFlowNode[]
  edges: Edge[]
  selectedNodeId: string | null
  validationIssues: ValidationIssue[]
  /** O(1) node-type lookup for per-edge selectors; rebuilt on membership changes. */
  nodeTypeById: Record<string, AgentFlowNodeType>
  history: Snapshot[]
  future: Snapshot[]
  onNodesChange: (changes: NodeChange<AgentFlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (type: AgentFlowNodeType, position: XYPosition) => void
  updateNodeData: (id: string, patch: Partial<AgentFlowNodeData>) => void
  setSelectedNode: (id: string | null) => void
  /** Select exactly one node (used by the trace log to highlight entries). */
  selectOnly: (id: string) => void
  clearCanvas: () => void
  loadGraph: (nodes: AgentFlowNode[], edges: Edge[]) => void
  undo: () => void
  redo: () => void
  deleteSelected: () => void
  duplicateSelected: () => void
  selectAll: () => void
  deselectAll: () => void
  updateEdgeLabel: (id: string, label: string) => void
  setEdgeKind: (id: string, kind: EdgeKind) => void
  removeEdge: (id: string) => void
  groupSelected: () => void
  toggleGroupCollapse: (id: string) => void
}

/**
 * When group frames are deleted, re-anchor their children to absolute
 * coordinates so they don't reference a missing parent.
 */
function releaseOrphans(
  nodes: AgentFlowNode[],
  removedGroups: Map<string, XYPosition>,
): AgentFlowNode[] {
  if (removedGroups.size === 0) return nodes
  return nodes.map((n) => {
    const groupPos = n.parentId ? removedGroups.get(n.parentId) : undefined
    if (!groupPos) return n
    return {
      ...n,
      parentId: undefined,
      hidden: false,
      position: {
        x: n.position.x + groupPos.x,
        y: n.position.y + groupPos.y,
      },
    }
  })
}

const HISTORY_LIMIT = 50

/** Bundle a graph mutation with a fresh validation pass and type lookup. */
function validated(nodes: AgentFlowNode[], edges: Edge[]) {
  const nodeTypeById: Record<string, AgentFlowNodeType> = {}
  for (const n of nodes) {
    if (n.type !== undefined) nodeTypeById[n.id] = n.type
  }
  return {
    nodes,
    edges,
    nodeTypeById,
    validationIssues: validateGraph(nodes, edges),
  }
}

// Throttle history snapshots for rapid-fire data edits (typing in the
// inspector) so undo steps back over whole edits, not single keystrokes.
let lastDataSnapshotAt = 0
// True while a node drag is in flight; the pre-drag state is snapshotted
// on the first position change of the drag only.
let dragInProgress = false

export const useCanvasStore = create<CanvasState>((set, get) => {
  const pushHistory = () => {
    const { nodes, edges, history } = get()
    set({
      history: [...history.slice(-(HISTORY_LIMIT - 1)), { nodes, edges }],
      future: [],
    })
  }

  return {
    nodes: [],
    edges: [],
    selectedNodeId: null,
    validationIssues: [],
    nodeTypeById: {},
    history: [],
    future: [],

    onNodesChange: (changes) => {
      const dragChange = changes.find(
        (c) => c.type === 'position' && c.dragging === true,
      )
      if (dragChange && !dragInProgress) {
        dragInProgress = true
        pushHistory()
      }
      if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
        dragInProgress = false
      }
      // Pure move/resize/selection changes can't alter node membership or
      // validation results — apply them without the O(N·E) revalidation.
      if (
        changes.every(
          (c) =>
            c.type === 'position' ||
            c.type === 'dimensions' ||
            c.type === 'select',
        )
      ) {
        set({ nodes: applyNodeChanges(changes, get().nodes) })
        return
      }
      const removeIds = new Set(
        changes.filter((c) => c.type === 'remove').map((c) => c.id),
      )
      if (removeIds.size > 0) {
        pushHistory()
      }
      const removedGroups = new Map(
        get()
          .nodes.filter((n) => n.type === 'group' && removeIds.has(n.id))
          .map((n) => [n.id, n.position]),
      )
      const nodes = releaseOrphans(
        applyNodeChanges(changes, get().nodes),
        removedGroups,
      )
      const selected = get().selectedNodeId
      set({
        ...validated(nodes, get().edges),
        selectedNodeId:
          selected && nodes.some((n) => n.id === selected) ? selected : null,
      })
    },

    onEdgesChange: (changes) => {
      if (changes.some((c) => c.type === 'remove')) {
        pushHistory()
      }
      set(validated(get().nodes, applyEdgeChanges(changes, get().edges)))
    },

    onConnect: (connection) => {
      pushHistory()
      set(
        validated(
          get().nodes,
          addEdge(
            { ...connection, type: 'agentflow', animated: true },
            get().edges,
          ),
        ),
      )
    },

    addNode: (type, position) => {
      pushHistory()
      const node: AgentFlowNode = {
        id: `${type}-${crypto.randomUUID().slice(0, 8)}`,
        type,
        position,
        data: createDefaultNodeData(type),
      }
      set(validated([...get().nodes, node], get().edges))
    },

    updateNodeData: (id, patch) => {
      const now = Date.now()
      if (now - lastDataSnapshotAt > 800) {
        pushHistory()
        lastDataSnapshotAt = now
      }
      const nodes = get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      )
      set(validated(nodes, get().edges))
    },

    setSelectedNode: (id) => set({ selectedNodeId: id }),

    selectOnly: (id) =>
      set({
        nodes: get().nodes.map((n) => ({ ...n, selected: n.id === id })),
        edges: get().edges.map((e) =>
          e.selected ? { ...e, selected: false } : e,
        ),
        selectedNodeId: id,
      }),

    clearCanvas: () => {
      pushHistory()
      set({ ...validated([], []), selectedNodeId: null })
    },

    loadGraph: (nodes, edges) => {
      pushHistory()
      set({ ...validated(nodes, edges), selectedNodeId: null })
    },

    undo: () => {
      const { history, future, nodes, edges } = get()
      const previous = history[history.length - 1]
      if (!previous) return
      set({
        ...validated(previous.nodes, previous.edges),
        history: history.slice(0, -1),
        future: [...future, { nodes, edges }],
        selectedNodeId: null,
      })
    },

    redo: () => {
      const { history, future, nodes, edges } = get()
      const next = future[future.length - 1]
      if (!next) return
      set({
        ...validated(next.nodes, next.edges),
        history: [...history.slice(-(HISTORY_LIMIT - 1)), { nodes, edges }],
        future: future.slice(0, -1),
        selectedNodeId: null,
      })
    },

    deleteSelected: () => {
      const { nodes, edges } = get()
      const nodeIds = new Set(
        nodes.filter((n) => n.selected).map((n) => n.id),
      )
      const edgeIds = new Set(
        edges.filter((e) => e.selected).map((e) => e.id),
      )
      if (nodeIds.size === 0 && edgeIds.size === 0) return
      pushHistory()
      const removedGroups = new Map(
        nodes
          .filter((n) => n.type === 'group' && nodeIds.has(n.id))
          .map((n) => [n.id, n.position]),
      )
      const remainingNodes = releaseOrphans(
        nodes.filter((n) => !nodeIds.has(n.id)),
        removedGroups,
      )
      const remainingEdges = edges.filter(
        (e) =>
          !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target),
      )
      const selected = get().selectedNodeId
      set({
        ...validated(remainingNodes, remainingEdges),
        selectedNodeId:
          selected && !nodeIds.has(selected) ? selected : null,
      })
    },

    duplicateSelected: () => {
      const { nodes, edges } = get()
      // Group frames are skipped: duplicating one would need child remapping.
      const targets = nodes.filter((n) => n.selected && n.type !== 'group')
      if (targets.length === 0) return
      pushHistory()
      const idMap = new Map<string, string>()
      const clones: AgentFlowNode[] = targets.map((n) => {
        const cloneId = `${n.type}-${crypto.randomUUID().slice(0, 8)}`
        idMap.set(n.id, cloneId)
        return {
          ...n,
          id: cloneId,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          data: { ...n.data },
          selected: true,
        }
      })
      // Also clone edges whose both ends were duplicated.
      const clonedEdges: Edge[] = edges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          ...e,
          id: `edge-${crypto.randomUUID().slice(0, 8)}`,
          source: idMap.get(e.source) ?? e.source,
          target: idMap.get(e.target) ?? e.target,
          selected: false,
        }))
      const newNodes = [
        ...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        ...clones,
      ]
      set(validated(newNodes, [...edges, ...clonedEdges]))
    },

    selectAll: () => {
      set({
        nodes: get().nodes.map((n) => ({ ...n, selected: true })),
      })
    },

    updateEdgeLabel: (id, label) => {
      set({
        edges: get().edges.map((e) => (e.id === id ? { ...e, label } : e)),
      })
    },

    setEdgeKind: (id, kind) => {
      pushHistory()
      set({
        edges: get().edges.map((e) =>
          e.id === id
            ? {
                ...e,
                data: { ...e.data, edgeType: kind },
                ...markersForKind(kind),
              }
            : e,
        ),
      })
    },

    removeEdge: (id) => {
      pushHistory()
      set(
        validated(
          get().nodes,
          get().edges.filter((e) => e.id !== id),
        ),
      )
    },

    groupSelected: () => {
      const { nodes, edges } = get()
      // Only top-level, non-group nodes can be wrapped in a new frame.
      const targets = nodes.filter(
        (n) => n.selected && n.type !== 'group' && !n.parentId,
      )
      if (targets.length < 2) return
      pushHistory()
      const PAD = 48
      const HEADER = 64
      const FALLBACK_W = 208
      const FALLBACK_H = 80
      const minX = Math.min(...targets.map((n) => n.position.x))
      const minY = Math.min(...targets.map((n) => n.position.y))
      const maxX = Math.max(
        ...targets.map((n) => n.position.x + (n.measured?.width ?? FALLBACK_W)),
      )
      const maxY = Math.max(
        ...targets.map((n) => n.position.y + (n.measured?.height ?? FALLBACK_H)),
      )
      const groupId = `group-${crypto.randomUUID().slice(0, 8)}`
      const group: AgentFlowNode = {
        id: groupId,
        type: 'group',
        position: { x: minX - PAD, y: minY - HEADER },
        width: maxX - minX + PAD * 2,
        height: maxY - minY + HEADER + PAD,
        data: { label: 'Group', collapsed: false },
      }
      const targetIds = new Set(targets.map((n) => n.id))
      // Parent frames must precede their children in the nodes array.
      const newNodes: AgentFlowNode[] = [
        group,
        ...nodes.map((n) =>
          targetIds.has(n.id)
            ? {
                ...n,
                parentId: groupId,
                position: {
                  x: n.position.x - group.position.x,
                  y: n.position.y - group.position.y,
                },
                selected: false,
              }
            : n,
        ),
      ]
      set(validated(newNodes, edges))
    },

    toggleGroupCollapse: (id) => {
      const { nodes, edges } = get()
      const group = nodes.find((n) => n.id === id)
      if (!group || group.type !== 'group') return
      const collapsing = group.data.collapsed !== true
      const childIds = new Set(
        nodes.filter((n) => n.parentId === id).map((n) => n.id),
      )
      const newNodes = nodes.map((n) => {
        if (n.id === id) {
          if (collapsing) {
            return {
              ...n,
              data: {
                ...n.data,
                collapsed: true,
                expandedWidth: n.width,
                expandedHeight: n.height,
              },
              width: 220,
              height: 48,
            }
          }
          return {
            ...n,
            data: { ...n.data, collapsed: false },
            width: n.data.expandedWidth ?? 400,
            height: n.data.expandedHeight ?? 300,
          }
        }
        if (n.parentId === id) return { ...n, hidden: collapsing }
        return n
      })
      const newEdges = edges.map((e) =>
        childIds.has(e.source) || childIds.has(e.target)
          ? { ...e, hidden: collapsing }
          : e,
      )
      set({ nodes: newNodes, edges: newEdges })
    },

    deselectAll: () => {
      set({
        nodes: get().nodes.map((n) =>
          n.selected ? { ...n, selected: false } : n,
        ),
        edges: get().edges.map((e) =>
          e.selected ? { ...e, selected: false } : e,
        ),
        selectedNodeId: null,
      })
    },
  }
})
