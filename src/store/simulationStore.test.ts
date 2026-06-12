import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { AgentFlowNode, AgentFlowNodeData, AgentFlowNodeType } from '../types'
import { useCanvasStore } from './canvasStore'
import { useSimulationStore } from './simulationStore'

function node(
  id: string,
  type: AgentFlowNodeType,
  data?: Partial<AgentFlowNodeData>,
): AgentFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } }
}

function edge(source: string, target: string, label?: string): Edge {
  const e: Edge = { id: `${source}->${target}`, source, target }
  if (label !== undefined) e.label = label
  return e
}

function loadGraph(nodes: AgentFlowNode[], edges: Edge[]): void {
  useCanvasStore.setState({ nodes, edges })
}

/** Run the simulation to completion (timers are instant in tests). */
async function runToEnd(): Promise<ReturnType<typeof useSimulationStore.getState>> {
  useSimulationStore.getState().start()
  await vi.waitFor(() => {
    const s = useSimulationStore.getState()
    expect(s.executionQueue.length).toBeGreaterThan(0)
    expect(s.currentNodeIndex).toBeGreaterThanOrEqual(s.executionQueue.length)
    expect(s.isRunning).toBe(false)
  })
  return useSimulationStore.getState()
}

beforeEach(() => {
  useSimulationStore.getState().stop()
})

describe('simulation queue walker — condition branches', () => {
  // Diamond: start → cond, cond →(yes) a → out, cond →(no) b → out
  const diamond = () =>
    loadGraph(
      [
        node('s', 'start'),
        node('c', 'condition', { branches: ['yes', 'no'] }),
        node('a', 'llm'),
        node('b', 'tool'),
        node('o', 'output'),
      ],
      [
        edge('s', 'c'),
        edge('c', 'a', 'yes'),
        edge('c', 'b', 'no'),
        edge('a', 'o'),
        edge('b', 'o'),
      ],
    )

  it('executes only the taken branch and skip-marks the other', async () => {
    diamond()
    const s = await runToEnd()
    // First visit takes the first outgoing edge ("yes" → a).
    expect(s.executionQueue).toEqual(['s', 'c', 'a', 'o'])
    expect([...s.executedIds].sort()).toEqual(['a', 'c', 'o', 's'])
    expect([...s.skippedNodeIds]).toEqual(['b'])
  })

  it('records a skipped trace entry instead of executing the branch', async () => {
    diamond()
    const s = await runToEnd()
    const bEntries = s.trace.filter((t) => t.nodeId === 'b')
    expect(bEntries).toHaveLength(1)
    expect(bEntries[0].status).toBe('skipped')
    expect(s.trace.filter((t) => t.status === 'ok')).toHaveLength(4)
    expect(s.nodeOutputs).not.toHaveProperty('b')
  })

  it('does not skip a join node shared by both branches', async () => {
    diamond()
    const s = await runToEnd()
    expect(s.skippedNodeIds.has('o')).toBe(false)
    expect(s.executedIds.has('o')).toBe(true)
  })

  it("reports the taken edge in the condition's output", async () => {
    diamond()
    const s = await runToEnd()
    expect(s.nodeOutputs.c).toMatchObject({ taken: 'yes' })
  })
})

describe('simulation queue walker — loop semantics', () => {
  // ReAct-style loop: start → cond, cond →(continue) a → cond, cond →(done) b
  const loop = () =>
    loadGraph(
      [
        node('s', 'start'),
        node('c', 'condition', { branches: ['continue', 'done'] }),
        node('a', 'llm'),
        node('b', 'output'),
      ],
      [
        edge('s', 'c'),
        edge('c', 'a', 'continue'),
        edge('c', 'b', 'done'),
        edge('a', 'c'),
      ],
    )

  it('re-executes the condition once, then exits via the last branch', async () => {
    loop()
    const s = await runToEnd()
    expect(s.executionQueue).toEqual(['s', 'c', 'a', 'c', 'b'])
    const condRuns = s.trace.filter((t) => t.nodeId === 'c' && t.status === 'ok')
    expect(condRuns).toHaveLength(2)
    expect(condRuns[0].output).toContain('"taken":"continue"')
    expect(condRuns[1].output).toContain('"taken":"done"')
  })

  it('does not skip-mark loop members reachable from the taken path', async () => {
    loop()
    const s = await runToEnd()
    expect(s.skippedNodeIds.size).toBe(0)
  })
})

describe('simulation queue walker — MAX_NODE_VISITS budget', () => {
  it('bounds a pure two-node cycle to two visits per node', async () => {
    loadGraph(
      [node('a', 'llm'), node('b', 'tool')],
      [edge('a', 'b'), edge('b', 'a')],
    )
    const s = await runToEnd()
    // Each node enqueued at most MAX_NODE_VISITS (2) times, then the run ends.
    expect(s.executionQueue).toEqual(['a', 'b', 'a', 'b'])
    const visits = (id: string) =>
      s.trace.filter((t) => t.nodeId === id && t.status === 'ok').length
    expect(visits('a')).toBe(2)
    expect(visits('b')).toBe(2)
  })

  it('never enqueues the same pending node twice', async () => {
    // Two parallel paths converging: s → a → o and s → b → o.
    loadGraph(
      [node('s', 'start'), node('a', 'llm'), node('b', 'tool'), node('o', 'output')],
      [edge('s', 'a'), edge('s', 'b'), edge('a', 'o'), edge('b', 'o')],
    )
    const s = await runToEnd()
    expect(s.executionQueue).toEqual(['s', 'a', 'b', 'o'])
    expect(s.trace.filter((t) => t.nodeId === 'o')).toHaveLength(1)
  })
})
