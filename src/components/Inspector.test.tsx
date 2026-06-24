import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
