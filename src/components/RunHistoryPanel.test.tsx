import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunHistoryPanel } from './RunHistoryPanel'
import { useRunHistoryStore } from '../store/runHistoryStore'
import type { RunRecord, TraceEntry } from '../types'

function traceEntry(nodeId: string, output: string): TraceEntry {
  return {
    id: `${nodeId}-1`,
    at: 0,
    nodeId,
    nodeName: nodeId,
    nodeType: 'llm',
    status: 'ok',
    durationMs: 100,
    input: 'in',
    output,
  }
}

function makeRun(id: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    durationMs: 2500,
    mode: 'simulated',
    status: 'done',
    nodeCount: 2,
    stepCount: 2,
    totalTokens: 120,
    totalCostUsd: 0,
    model: `model-${id}`,
    qualityScore: null,
    evalPassCount: null,
    evalTotalCount: null,
    traceSnapshot: [traceEntry('n1', `out-${id}`)],
    snapshots: [],
    costSnapshot: null,
    ...overrides,
  }
}

beforeEach(() => {
  useRunHistoryStore.setState({
    runs: [],
    panelOpen: true,
    searchQuery: '',
    filterStatus: 'all',
    filterMode: 'all',
    selectedRunId: null,
    compareRunIds: null,
  })
})

describe('RunHistoryPanel', () => {
  it('shows the empty state when there are no runs', () => {
    render(<RunHistoryPanel />)
    expect(screen.getByText(/No runs yet/)).not.toBeNull()
  })

  it('renders a run card with the run model and no empty state', () => {
    useRunHistoryStore.setState({ runs: [makeRun('a')] })
    render(<RunHistoryPanel />)
    expect(screen.getByText('model-a')).not.toBeNull()
    expect(screen.queryByText(/No runs yet/)).toBeNull()
  })

  it('selecting two runs populates compareRunIds with their ids', async () => {
    useRunHistoryStore.setState({ runs: [makeRun('a'), makeRun('b')] })
    render(<RunHistoryPanel />)
    const boxes = screen.getAllByTitle('Select to compare')
    await userEvent.click(boxes[0])
    await userEvent.click(boxes[1])
    expect(useRunHistoryStore.getState().compareRunIds).toEqual(['a', 'b'])
  })

  it('renders the diff table when two distinct runs are being compared', () => {
    useRunHistoryStore.setState({
      runs: [makeRun('a'), makeRun('b')],
      compareRunIds: ['a', 'b'],
    })
    render(<RunHistoryPanel />)
    expect(screen.getByText('Comparing 2 runs')).not.toBeNull()
  })

  it('selecting a third run keeps the first and replaces the second', async () => {
    useRunHistoryStore.setState({
      runs: [makeRun('a'), makeRun('b'), makeRun('c')],
      compareRunIds: ['a', 'b'],
    })
    render(<RunHistoryPanel />)
    const boxes = screen.getAllByTitle('Select to compare')
    await userEvent.click(boxes[2])
    expect(useRunHistoryStore.getState().compareRunIds).toEqual(['a', 'c'])
  })

  it('clears all runs via the clear-all control', async () => {
    useRunHistoryStore.setState({ runs: [makeRun('a'), makeRun('b')] })
    render(<RunHistoryPanel />)
    await userEvent.click(screen.getByTitle('Clear all runs'))
    expect(useRunHistoryStore.getState().runs).toEqual([])
  })
})
