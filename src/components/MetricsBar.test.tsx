import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricsBar } from './MetricsBar'
import { useSimulationStore } from '../store/simulationStore'

beforeEach(() => {
  useSimulationStore.setState({ pendingApproval: null, isActive: true })
})

describe('MetricsBar — no inline approval buttons', () => {
  it('renders no Approve/Reject buttons when pendingApproval is set', () => {
    useSimulationStore.setState({ pendingApproval: { nodeId: 'node-1' } })
    render(<MetricsBar />)
    expect(screen.queryByText('Approve')).toBeNull()
    expect(screen.queryByText('Reject')).toBeNull()
  })

  it('renders no Approve/Reject buttons when pendingApproval is null', () => {
    render(<MetricsBar />)
    expect(screen.queryByText('Approve')).toBeNull()
    expect(screen.queryByText('Reject')).toBeNull()
  })
})

describe('MetricsBar — latency badge', () => {
  it('shows a latency badge for the last completed span when spanLog has entries', () => {
    useSimulationStore.setState({
      spanLog: [
        {
          spanId: 'span-1',
          nodeId: 'n1',
          nodeName: 'LLM Node',
          nodeType: 'llm',
          startTime: 0,
          endTime: 250,
          durationMs: 250,
          status: 'ok',
          tokensIn: 10,
          tokensOut: 20,
          costUsd: 0.0004,
        },
      ],
    })
    render(<MetricsBar />)
    expect(screen.getByText('250ms')).not.toBeNull()
    expect(screen.getByText('latency')).not.toBeNull()
  })

  it('shows no latency badge when spanLog is empty', () => {
    useSimulationStore.setState({ spanLog: [] })
    render(<MetricsBar />)
    expect(screen.queryByText('latency')).toBeNull()
  })
})
