import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from './canvasStore'
import { useSnapshotStore } from './snapshotStore'
import type { AgentFlowNode } from '../types'

function llmNode(id: string): AgentFlowNode {
  return { id, type: 'llm', position: { x: 0, y: 0 }, data: { label: id } }
}

beforeEach(() => {
  useSnapshotStore.setState({ snapshots: [] })
  useCanvasStore.setState({ nodes: [], edges: [], history: [], future: [] })
})

describe('snapshotStore — saveSnapshot', () => {
  it('adds a new entry with the given name and copies of the current nodes/edges', () => {
    useCanvasStore.setState({ nodes: [llmNode('n1')], edges: [] })

    useSnapshotStore.getState().saveSnapshot('My Save')

    const { snapshots } = useSnapshotStore.getState()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].name).toBe('My Save')
    expect(snapshots[0].nodes).toEqual([llmNode('n1')])
    // Deep-cloned, not the same reference as the live canvas array.
    expect(snapshots[0].nodes).not.toBe(useCanvasStore.getState().nodes)
  })

  it('evicts the oldest slot when more than 10 snapshots exist', () => {
    for (let i = 0; i < 10; i++) {
      useSnapshotStore.getState().saveSnapshot(`Slot ${i}`)
    }
    expect(useSnapshotStore.getState().snapshots).toHaveLength(10)
    expect(useSnapshotStore.getState().snapshots[0].name).toBe('Slot 0')

    useSnapshotStore.getState().saveSnapshot('Slot 10')

    const { snapshots } = useSnapshotStore.getState()
    expect(snapshots).toHaveLength(10)
    expect(snapshots[0].name).toBe('Slot 1')
    expect(snapshots[9].name).toBe('Slot 10')
  })
})

describe('snapshotStore — deleteSnapshot', () => {
  it('removes the entry matching the given id', () => {
    useSnapshotStore.getState().saveSnapshot('Keep')
    useSnapshotStore.getState().saveSnapshot('Drop')
    const dropId = useSnapshotStore.getState().snapshots[1].id

    useSnapshotStore.getState().deleteSnapshot(dropId)

    const { snapshots } = useSnapshotStore.getState()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].name).toBe('Keep')
  })
})

describe('snapshotStore — restoreSnapshot', () => {
  it('calls canvasStore.loadGraph with the snapshot nodes and edges', () => {
    useCanvasStore.setState({ nodes: [llmNode('n1')], edges: [] })
    useSnapshotStore.getState().saveSnapshot('Restore me')
    const snap = useSnapshotStore.getState().snapshots[0]

    const loadGraph = vi.fn()
    useCanvasStore.setState({ loadGraph })

    useSnapshotStore.getState().restoreSnapshot(snap.id)

    expect(loadGraph).toHaveBeenCalledWith(snap.nodes, snap.edges)
  })
})
