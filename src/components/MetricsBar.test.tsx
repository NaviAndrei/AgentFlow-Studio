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
