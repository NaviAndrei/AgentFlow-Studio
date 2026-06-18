// T2-2: verifies the Time-Travel Debugger's snapshot capture + archival.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge } from '@xyflow/react'
import type {
  AgentFlowNode,
  AgentFlowNodeData,
  AgentFlowNodeType,
} from '../types'
import { useCanvasStore } from './canvasStore'
import { useSimulationStore } from './simulationStore'
import { useRunHistoryStore } from './runHistoryStore'
import { streamChat } from '../llm'

vi.mock('../llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm')>()
  return { ...actual, streamChat: vi.fn() }
})

function node(
  id: string,
  type: AgentFlowNodeType,
  data?: Partial<AgentFlowNodeData>,
): AgentFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } }
}

function edge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target }
}

async function runToEnd() {
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
  useSimulationStore.getState().setLiveMode(false)
  useRunHistoryStore.setState({ runs: [], selectedRunId: null })
  vi.mocked(streamChat).mockReset()
  vi.mocked(streamChat).mockResolvedValue('(mock live reply)')
})

describe('time-travel snapshots', () => {
  const linear = () => {
    useCanvasStore.setState({
      nodes: [node('s', 'start'), node('l', 'llm'), node('o', 'output')],
      edges: [edge('s', 'l'), edge('l', 'o')],
    })
  }

  it('captures one snapshot per executed node, in order, with full output', async () => {
    linear()
    const s = await runToEnd()
    expect(s.snapshots.map((sn) => sn.nodeId)).toEqual(['s', 'l', 'o'])
    s.snapshots.forEach((sn, i) => {
      expect(sn.stepIndex).toBe(i)
      expect(sn.status).toBe('ok')
      // inputState keeps the resolved-input shape (config + upstream + knobs).
      expect(sn.inputState).toHaveProperty('upstream')
      expect(sn.inputState).toHaveProperty('userInput')
    })
  })

  it('archives snapshots onto the recorded RunRecord', async () => {
    linear()
    await runToEnd()
    const runs = useRunHistoryStore.getState().runs
    expect(runs.length).toBe(1)
    expect(runs[0].snapshots.map((sn) => sn.nodeId)).toEqual(['s', 'l', 'o'])
  })

  it('clears snapshots on stop', async () => {
    linear()
    await runToEnd()
    expect(useSimulationStore.getState().snapshots.length).toBeGreaterThan(0)
    useSimulationStore.getState().stop()
    expect(useSimulationStore.getState().snapshots).toEqual([])
  })
})
