import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from './canvasStore'
import { setRfInstance } from '../utils/rfInstance'
import type { AgentFlowNode } from '../types'

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    history: [],
    future: [],
    selectedNodeId: null,
  })
})

describe('canvasStore — undo/redo label plumbing', () => {
  it('undo returns the label of the action it reverted', () => {
    useCanvasStore.getState().addNode('llm', { x: 0, y: 0 })
    expect(useCanvasStore.getState().history).toHaveLength(1)

    const label = useCanvasStore.getState().undo()
    expect(label).toBe('Add llm node')
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })

  it('undo returns null when there is nothing to undo', () => {
    expect(useCanvasStore.getState().history).toHaveLength(0)
    expect(useCanvasStore.getState().undo()).toBeNull()
  })

  it('redo returns the label of the action it replayed', () => {
    useCanvasStore.getState().addNode('llm', { x: 0, y: 0 })
    useCanvasStore.getState().undo()

    const label = useCanvasStore.getState().redo()
    expect(label).toBe('Add llm node')
    expect(useCanvasStore.getState().nodes).toHaveLength(1)
  })

  it('redo returns null when there is nothing to redo', () => {
    expect(useCanvasStore.getState().future).toHaveLength(0)
    expect(useCanvasStore.getState().redo()).toBeNull()
  })

  it('loadGraph clears both history and future', () => {
    useCanvasStore.getState().addNode('llm', { x: 0, y: 0 })
    useCanvasStore.getState().addNode('tool', { x: 10, y: 10 })
    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().history.length).toBeGreaterThan(0)
    expect(useCanvasStore.getState().future.length).toBeGreaterThan(0)

    useCanvasStore.getState().loadGraph([], [])
    expect(useCanvasStore.getState().history).toEqual([])
    expect(useCanvasStore.getState().future).toEqual([])
  })

  it('loadGraph restores the viewport on the live RF instance when provided', () => {
    let received: unknown = null
    // @ts-expect-error — minimal stub; only setViewport is exercised by loadGraph.
    setRfInstance({ setViewport: (vp: unknown) => { received = vp } })

    useCanvasStore.getState().loadGraph([], [], { x: 10, y: 20, zoom: 0.8 })
    expect(received).toEqual({ x: 10, y: 20, zoom: 0.8 })

    setRfInstance(null)
  })

  it('loadGraph does not touch the viewport when none is provided', () => {
    let called = false
    // @ts-expect-error — minimal stub; only setViewport is exercised by loadGraph.
    setRfInstance({ setViewport: () => { called = true } })

    useCanvasStore.getState().loadGraph([], [])
    expect(called).toBe(false)

    setRfInstance(null)
  })
})

describe('canvasStore — node color tagging', () => {
  it('a color survives an undo/redo cycle', () => {
    useCanvasStore.getState().addNode('llm', { x: 0, y: 0 })
    const id = useCanvasStore.getState().nodes[0].id

    useCanvasStore.getState().updateNodeData(id, { color: '#ea580c' })
    expect(useCanvasStore.getState().nodes[0].data.color).toBe('#ea580c')

    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().nodes[0].data.color).toBeUndefined()

    useCanvasStore.getState().redo()
    expect(useCanvasStore.getState().nodes[0].data.color).toBe('#ea580c')
  })
})

describe('canvasStore — getProblemsByNodeId', () => {
  it('groups validation issues under their node id', () => {
    // An LLM node with no model selected raises a node-scoped validation error.
    const nodes: AgentFlowNode[] = [
      { id: 'n1', type: 'llm', position: { x: 0, y: 0 }, data: { label: 'LLM' } },
    ]
    useCanvasStore.getState().loadGraph(nodes, [])

    const map = useCanvasStore.getState().getProblemsByNodeId()
    expect(map.has('n1')).toBe(true)
    expect(map.get('n1')?.some((i) => i.message.includes('model'))).toBe(true)
  })
})
