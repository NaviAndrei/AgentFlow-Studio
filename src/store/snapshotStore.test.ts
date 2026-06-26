import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from './canvasStore'
import { useSnapshotStore } from './snapshotStore'
import { useToastStore } from './toastStore'
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

describe('snapshotStore — restoreSnapshot warns about missing tokens', () => {
  it('pushes a warning toast when a restored node has endpointUrl but no authToken', () => {
    const restoredNode: AgentFlowNode = {
      id: 't1',
      type: 'tool',
      position: { x: 0, y: 0 },
      data: { label: 't1', endpointUrl: 'https://api.example.com/tool', authToken: undefined },
    }
    useSnapshotStore.setState({
      snapshots: [{ id: 's1', name: 'S', savedAt: new Date().toISOString(), nodes: [restoredNode], edges: [] }],
    })
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    useSnapshotStore.getState().restoreSnapshot('s1')

    expect(pushToast).toHaveBeenCalledTimes(1)
    const [, tone] = pushToast.mock.calls[0]
    expect(tone).toBe('warning')
  })

  it('does not push a toast when restored nodes have authToken set', () => {
    const restoredNode: AgentFlowNode = {
      id: 't1',
      type: 'tool',
      position: { x: 0, y: 0 },
      data: { label: 't1', endpointUrl: 'https://api.example.com/tool', authToken: 'secret' },
    }
    useSnapshotStore.setState({
      snapshots: [{ id: 's1', name: 'S', savedAt: new Date().toISOString(), nodes: [restoredNode], edges: [] }],
    })
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    useSnapshotStore.getState().restoreSnapshot('s1')

    expect(pushToast).not.toHaveBeenCalled()
  })
})

function toolNode(id: string, authToken: string): AgentFlowNode {
  return {
    id,
    type: 'tool',
    position: { x: 0, y: 0 },
    data: { label: id, authToken, endpointUrl: 'https://api.example.com/tool' },
  }
}

describe('snapshotStore — saveSnapshot persistence excludes authToken', () => {
  it('does not write authToken to localStorage', () => {
    useCanvasStore.setState({ nodes: [toolNode('t1', 'super-secret')], edges: [] })

    useSnapshotStore.getState().saveSnapshot('With Token')

    const raw = localStorage.getItem('agentflow-snapshots-v1')
    expect(raw).not.toBeNull()
    expect(raw).not.toContain('authToken')
    expect(raw).not.toContain('super-secret')
  })

  it('hydrating from storage with no authToken leaves node.data.authToken undefined', () => {
    useCanvasStore.setState({ nodes: [toolNode('t1', 'super-secret')], edges: [] })
    useSnapshotStore.getState().saveSnapshot('With Token')

    useSnapshotStore.setState({ snapshots: [] })
    useSnapshotStore.getState()._loadFromStorage()

    const { snapshots } = useSnapshotStore.getState()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].nodes[0].data.authToken).toBeUndefined()
  })
})
