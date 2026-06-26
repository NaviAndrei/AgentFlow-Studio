import { create } from 'zustand'
import { useCanvasStore } from './canvasStore'
import type { AgentFlowEdge, AgentFlowNode } from '../types'

export interface FlowSnapshot {
  id: string
  name: string
  savedAt: string
  nodes: AgentFlowNode[]
  edges: AgentFlowEdge[]
}

interface SnapshotState {
  snapshots: FlowSnapshot[]
  saveSnapshot: (name: string) => void
  restoreSnapshot: (id: string) => void
  deleteSnapshot: (id: string) => void
  _loadFromStorage: () => void
}

const STORAGE_KEY = 'agentflow-snapshots-v1'
const MAX_SNAPSHOTS = 10

/** Quota errors (or storage being unavailable entirely) must never throw to the UI. */
function persist(snapshots: FlowSnapshot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots))
  } catch {
    // Snapshots remain usable for this session even if persistence fails.
  }
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  snapshots: [],

  saveSnapshot: (name) => {
    const trimmed = name.trim().slice(0, 40)
    if (trimmed === '') return
    const { nodes, edges } = useCanvasStore.getState()
    const snapshot: FlowSnapshot = {
      id: crypto.randomUUID(),
      name: trimmed,
      savedAt: new Date().toISOString(),
      // Severs reactivity — later canvas edits must not mutate the saved slot.
      // authToken is stripped before persisting: secrets must never reach localStorage.
      nodes: JSON.parse(
        JSON.stringify(nodes.map((n) => ({ ...n, data: { ...n.data, authToken: undefined } }))),
      ) as AgentFlowNode[],
      edges: JSON.parse(JSON.stringify(edges)) as AgentFlowEdge[],
    }
    const next = [...get().snapshots, snapshot].slice(-MAX_SNAPSHOTS)
    set({ snapshots: next })
    persist(next)
  },

  restoreSnapshot: (id) => {
    const snapshot = get().snapshots.find((s) => s.id === id)
    if (!snapshot) return
    useCanvasStore.getState().loadGraph(snapshot.nodes, snapshot.edges)
    useCanvasStore.getState().markClean()
  },

  deleteSnapshot: (id) => {
    const next = get().snapshots.filter((s) => s.id !== id)
    set({ snapshots: next })
    persist(next)
  },

  _loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        set({ snapshots: [] })
        return
      }
      const parsed = JSON.parse(raw) as unknown
      set({ snapshots: Array.isArray(parsed) ? (parsed as FlowSnapshot[]) : [] })
    } catch {
      set({ snapshots: [] })
    }
  },
}))

useSnapshotStore.getState()._loadFromStorage()
