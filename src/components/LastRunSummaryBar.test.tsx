import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LastRunSummaryBar } from './LastRunSummaryBar'
import { useEvalStore } from '../store/evalStore'
import type { LastRunSummary } from '../types'

beforeEach(() => {
  useEvalStore.setState({ lastRunSummary: null })
})

describe('LastRunSummaryBar', () => {
  it('renders nothing when lastRunSummary is null', () => {
    const { container } = render(<LastRunSummaryBar />)
    expect(container.innerHTML).toBe('')
  })

  it('renders node count and latency with a success indicator when errorCount is 0', () => {
    const summary: LastRunSummary = {
      runId: 'run-1',
      timestamp: 1,
      nodesExecuted: 4,
      errorCount: 0,
      totalLatencyMs: 1234,
    }
    useEvalStore.getState().recordRunSummary(summary)
    render(<LastRunSummaryBar />)
    expect(screen.queryByText('4 nodes')).not.toBeNull()
    expect(screen.queryByText('1234ms')).not.toBeNull()
    expect(screen.queryByText('✓')).not.toBeNull()
  })

  it('renders error count with a warning indicator when errorCount > 0', () => {
    const summary: LastRunSummary = {
      runId: 'run-2',
      timestamp: 2,
      nodesExecuted: 5,
      errorCount: 2,
      totalLatencyMs: 500,
    }
    useEvalStore.getState().recordRunSummary(summary)
    render(<LastRunSummaryBar />)
    expect(screen.queryByText('2 errors')).not.toBeNull()
    expect(screen.queryByText('⚠')).not.toBeNull()
  })

  it('dismiss button calls clearRunSummary', async () => {
    const summary: LastRunSummary = {
      runId: 'run-3',
      timestamp: 3,
      nodesExecuted: 1,
      errorCount: 0,
      totalLatencyMs: 10,
    }
    useEvalStore.getState().recordRunSummary(summary)
    render(<LastRunSummaryBar />)
    await userEvent.click(screen.getByLabelText('Dismiss last run summary'))
    expect(useEvalStore.getState().lastRunSummary).toBeNull()
  })
})
