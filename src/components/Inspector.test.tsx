import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Inspector } from './Inspector'
import { useCanvasStore } from '../store/canvasStore'
import { useUIStore } from '../store/uiStore'
import type { AgentFlowNodeType } from '../types'

function selectNodeOfType(type: AgentFlowNodeType) {
  useCanvasStore.getState().addNode(type, { x: 0, y: 0 })
  const node = useCanvasStore.getState().nodes[0]
  useCanvasStore.setState({ selectedNodeId: node.id })
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    history: [],
    future: [],
    selectedNodeId: null,
  })
  useUIStore.setState({ inspectorOpen: true })
})

describe('Inspector — Max Tokens field', () => {
  it('renders the Max Tokens input for an llm node', () => {
    selectNodeOfType('llm')
    render(<Inspector />)
    // Throws (failing the test) if the field is absent — implicit assertion.
    expect(screen.getByText('Max Tokens')).not.toBeNull()
  })

  it('does not render the Max Tokens input for a router node', () => {
    selectNodeOfType('router')
    render(<Inspector />)
    expect(screen.queryByText('Max Tokens')).toBeNull()
  })
})

describe('Inspector tool: node — endpoint fields', () => {
  it('renders an Endpoint URL labeled input for a tool node', () => {
    selectNodeOfType('tool')
    render(<Inspector />)
    expect(screen.getByText('Endpoint URL')).not.toBeNull()
  })

  it('renders an Auth Token labeled input for a tool node', () => {
    selectNodeOfType('tool')
    render(<Inspector />)
    expect(screen.getByText('Auth Token')).not.toBeNull()
  })

  it('typing in Endpoint URL calls updateNodeData with the new value', async () => {
    const user = userEvent.setup()
    selectNodeOfType('tool')
    render(<Inspector />)
    const input = screen.getByPlaceholderText('https://your-tool-server.com/endpoint')
    await user.type(input, 'https://example.com/tool')
    const node = useCanvasStore.getState().nodes[0]
    expect(node.data.endpointUrl).toBe('https://example.com/tool')
  })

  it('renders both endpoint fields for a retriever node', () => {
    selectNodeOfType('retriever')
    render(<Inspector />)
    expect(screen.getByText('Endpoint URL')).not.toBeNull()
    expect(screen.getByText('Auth Token')).not.toBeNull()
  })
})
