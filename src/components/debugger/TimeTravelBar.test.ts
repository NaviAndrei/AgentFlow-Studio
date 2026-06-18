// T2-2: smoke + integration tests for the Time-Travel Debugger UI layer.
// The suite runs in a `node` environment (no jsdom), so this mirrors the
// project's non-rendering component-test convention: assert the modules load
// without throwing, then drive the playback through the stores end-to-end.
import { beforeEach, describe, expect, it } from 'vitest'
import { TimeTravelBar } from './TimeTravelBar'
import { SnapshotInspector } from './SnapshotInspector'
import { useDebuggerStore } from '../../store/debuggerStore'
import { useRunHistoryStore } from '../../store/runHistoryStore'
import type { RunRecord, StepSnapshot } from '../../types'

function snap(stepIndex: number, nodeId: string): StepSnapshot {
  return {
    stepIndex,
    nodeId,
    nodeName: nodeId,
    nodeType: 'llm',
    inputState: { upstream: [], userInput: '', liveMode: false },
    outputState: { value: stepIndex },
    at: stepIndex,
    durationMs: 1,
    status: 'ok',
  }
}

function runWithSnapshots(snapshots: StepSnapshot[]): RunRecord {
  return {
    id: 'r1',
    startedAt: 0,
    finishedAt: 1,
    durationMs: 1,
    mode: 'simulated',
    status: 'done',
    nodeCount: snapshots.length,
    stepCount: snapshots.length,
    totalTokens: 0,
    totalCostUsd: 0,
    model: 'sim',
    qualityScore: null,
    evalPassCount: null,
    evalTotalCount: null,
    traceSnapshot: [],
    snapshots,
    costSnapshot: null,
  }
}

beforeEach(() => {
  useDebuggerStore.getState().reset()
  useRunHistoryStore.setState({ runs: [], selectedRunId: null })
})

describe('TimeTravelBar / SnapshotInspector', () => {
  it('are renderable components (modules load cleanly)', () => {
    expect(typeof TimeTravelBar).toBe('function')
    expect(typeof SnapshotInspector).toBe('function')
  })

  it('a selected run with snapshots enables time travel', () => {
    const run = runWithSnapshots([snap(0, 's'), snap(1, 'l'), snap(2, 'o')])
    useRunHistoryStore.setState({ runs: [run], selectedRunId: 'r1' })
    const sel = useRunHistoryStore.getState()
    const found = sel.runs.find((r) => r.id === sel.selectedRunId)
    expect(found?.snapshots.length).toBe(3)
  })

  it('stepping forward tracks the active node across the run', () => {
    const run = runWithSnapshots([snap(0, 's'), snap(1, 'l'), snap(2, 'o')])
    useRunHistoryStore.setState({ runs: [run], selectedRunId: 'r1' })
    const dbg = useDebuggerStore.getState()
    run.snapshots.forEach((sn) => dbg.setActiveStep(sn.stepIndex, sn.nodeId))
    const s = useDebuggerStore.getState()
    expect(s.activeStepIndex).toBe(2)
    expect(s.activeStepNodeId).toBe('o')
  })
})
