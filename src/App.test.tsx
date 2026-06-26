import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'
import { useCanvasStore } from './store/canvasStore'
import { useToastStore } from './store/toastStore'
import type { AgentFlowNode } from './types'

function toolNode(id: string, endpointUrl?: string, authToken?: string): AgentFlowNode {
  return {
    id,
    type: 'tool',
    position: { x: 0, y: 0 },
    data: { label: `Node ${id}`, endpointUrl, authToken },
  }
}

beforeEach(() => {
  useCanvasStore.setState({ nodes: [], edges: [], history: [], future: [], selectedNodeId: null })
  useToastStore.setState({ toasts: [] })
})

describe('App mount — authToken reload warning', () => {
  it('warns when a tool: node has endpointUrl but no authToken', () => {
    useCanvasStore.setState({ nodes: [toolNode('t1', 'https://api.example.com/tool', undefined)] })
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    render(<App />)

    expect(pushToast).toHaveBeenCalledTimes(1)
    const [message, tone] = pushToast.mock.calls[0]
    expect(tone).toBe('warning')
    expect(message).toMatch(/token/i)
    expect(message).toContain('Node t1')
  })

  it('does not warn when endpointUrl and authToken are both set', () => {
    useCanvasStore.setState({
      nodes: [toolNode('t1', 'https://api.example.com/tool', 'secret')],
    })
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    render(<App />)

    expect(pushToast).not.toHaveBeenCalled()
  })

  it('does not warn when endpointUrl is unset (LLM-only mode)', () => {
    useCanvasStore.setState({ nodes: [toolNode('t1', undefined, undefined)] })
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    render(<App />)

    expect(pushToast).not.toHaveBeenCalled()
  })

  it('does not warn when there are no tool:/retriever: nodes', () => {
    useCanvasStore.setState({ nodes: [] })
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')

    render(<App />)

    expect(pushToast).not.toHaveBeenCalled()
  })
})
