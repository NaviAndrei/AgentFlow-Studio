import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../store/toastStore'
import { warnMissingTokens } from './warnMissingTokens'
import type { AgentFlowNode } from '../types'

function toolNode(id: string, endpointUrl?: string, authToken?: string): AgentFlowNode {
  return {
    id,
    type: 'tool',
    position: { x: 0, y: 0 },
    data: { label: `Node ${id}`, endpointUrl, authToken },
  }
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('warnMissingTokens', () => {
  it('pushes a warning toast when a node has endpointUrl but no authToken', () => {
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    warnMissingTokens([toolNode('t1', 'https://api.example.com/tool', undefined)])

    expect(pushToast).toHaveBeenCalledTimes(1)
    const [message, tone] = pushToast.mock.calls[0]
    expect(tone).toBe('warning')
    expect(message).toContain('Node t1')
  })

  it('does not push a toast when the list is empty', () => {
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    warnMissingTokens([])

    expect(pushToast).not.toHaveBeenCalled()
  })

  it('does not push a toast when authToken is set', () => {
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    warnMissingTokens([toolNode('t1', 'https://api.example.com/tool', 'secret')])

    expect(pushToast).not.toHaveBeenCalled()
  })
})
