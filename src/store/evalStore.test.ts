import { beforeEach, describe, expect, it } from 'vitest'
import { useEvalStore } from './evalStore'
import type { LastRunSummary } from '../types'

beforeEach(() => {
  useEvalStore.setState({ lastRunSummary: null, runs: [], testCases: [] })
})

describe('evalStore — lastRunSummary', () => {
  it('starts as null before any run', () => {
    expect(useEvalStore.getState().lastRunSummary).toBeNull()
  })

  it('records the summary passed to recordRunSummary', () => {
    const summary: LastRunSummary = {
      runId: 'run-1',
      timestamp: 1_700_000_000_000,
      nodesExecuted: 4,
      errorCount: 1,
      totalLatencyMs: 1234,
    }
    useEvalStore.getState().recordRunSummary(summary)
    expect(useEvalStore.getState().lastRunSummary).toEqual(summary)
  })

  it('overwrites the previous summary on the next run', () => {
    const first: LastRunSummary = {
      runId: 'run-1',
      timestamp: 1,
      nodesExecuted: 2,
      errorCount: 0,
      totalLatencyMs: 100,
    }
    const second: LastRunSummary = {
      runId: 'run-2',
      timestamp: 2,
      nodesExecuted: 5,
      errorCount: 2,
      totalLatencyMs: 500,
    }
    useEvalStore.getState().recordRunSummary(first)
    useEvalStore.getState().recordRunSummary(second)
    expect(useEvalStore.getState().lastRunSummary).toEqual(second)
  })

  it('clearRunSummary resets lastRunSummary to null', () => {
    const summary: LastRunSummary = {
      runId: 'run-1',
      timestamp: 1,
      nodesExecuted: 3,
      errorCount: 0,
      totalLatencyMs: 50,
    }
    useEvalStore.getState().recordRunSummary(summary)
    useEvalStore.getState().clearRunSummary()
    expect(useEvalStore.getState().lastRunSummary).toBeNull()
  })
})
