import { describe, expect, it } from 'vitest'
import { diffRuns } from './diffRuns'
import type { RunRecord, TraceEntry } from '../types'

function entry(overrides: Partial<TraceEntry>): TraceEntry {
  return {
    id: overrides.id ?? 'e1',
    at: 0,
    nodeId: 'n1',
    nodeName: 'Node 1',
    nodeType: 'llm',
    status: 'ok',
    durationMs: 100,
    input: '—',
    output: 'hello',
    ...overrides,
  }
}

function run(overrides: Partial<RunRecord>): RunRecord {
  return {
    id: 'r1',
    startedAt: 0,
    finishedAt: 100,
    durationMs: 100,
    mode: 'simulated',
    status: 'done',
    nodeCount: 1,
    stepCount: 1,
    totalTokens: 0,
    totalCostUsd: 0,
    model: 'gpt-4',
    qualityScore: null,
    evalPassCount: null,
    evalTotalCount: null,
    traceSnapshot: [],
    costSnapshot: null,
    ...overrides,
  }
}

describe('diffRuns', () => {
  it('returns empty array for identical runs', () => {
    const trace = [entry({})]
    const a = run({ traceSnapshot: trace })
    const b = run({ traceSnapshot: trace })
    expect(diffRuns(a, b)).toEqual([])
  })

  it('detects status change from ok to error', () => {
    const a = run({ traceSnapshot: [entry({ status: 'ok' })] })
    const b = run({ traceSnapshot: [entry({ status: 'error', output: 'boom' })] })
    const diff = diffRuns(a, b)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toMatchObject({ nodeId: 'n1', statusA: 'ok', statusB: 'error' })
  })

  it('detects output change between runs', () => {
    const a = run({ traceSnapshot: [entry({ output: 'hello' })] })
    const b = run({ traceSnapshot: [entry({ output: 'goodbye' })] })
    const diff = diffRuns(a, b)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toMatchObject({ outputA: 'hello', outputB: 'goodbye' })
  })

  it('calculates correct duration delta', () => {
    const a = run({ traceSnapshot: [entry({ durationMs: 100 })] })
    const b = run({ traceSnapshot: [entry({ durationMs: 250 })] })
    const diff = diffRuns(a, b)
    expect(diff).toHaveLength(1)
    expect(diff[0].durationDeltaMs).toBe(150)
  })
})
