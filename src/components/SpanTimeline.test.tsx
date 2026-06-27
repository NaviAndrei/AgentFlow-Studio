import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpanTimeline } from './SpanTimeline'
import type { RunSpan } from '../types'

function span(overrides: Partial<RunSpan>): RunSpan {
  return {
    spanId: 'span-1',
    nodeId: 'n1',
    nodeName: 'LLM Node',
    nodeType: 'llm',
    startTime: 0,
    endTime: 120,
    durationMs: 120,
    status: 'ok',
    tokensIn: 10,
    tokensOut: 20,
    costUsd: 0.0005,
    ...overrides,
  }
}

describe('SpanTimeline', () => {
  it('renders a proportional bar per span with its name and duration', () => {
    render(<SpanTimeline spans={[span({}), span({ spanId: 'span-2', nodeName: 'Output Node', durationMs: 60 })]} />)
    expect(screen.getByText('LLM Node')).not.toBeNull()
    expect(screen.getByText('Output Node')).not.toBeNull()
    expect(screen.getByText('120ms')).not.toBeNull()
    expect(screen.getByText('60ms')).not.toBeNull()
  })

  it('renders an empty-state message when there are no spans', () => {
    render(<SpanTimeline spans={[]} />)
    expect(screen.getByText('No spans recorded for this run.')).not.toBeNull()
  })
})
