import type { ReactFlowInstance } from '@xyflow/react'
import type { AgentFlowEdge, AgentFlowNode } from '../types'

/**
 * Module-level handle to the live React Flow instance, captured via the
 * `<ReactFlow onInit>` callback in Canvas.tsx. Lets non-component code (the
 * canvasStore, the global keyboard hook) drive the viewport — `fitView()`
 * after auto-layout, `setViewport()` after a JSON import — without needing to
 * be inside a component subtree that can call `useReactFlow()`.
 */
let instance: ReactFlowInstance<AgentFlowNode, AgentFlowEdge> | null = null

export function setRfInstance(
  next: ReactFlowInstance<AgentFlowNode, AgentFlowEdge> | null,
): void {
  instance = next
}

export function getRfInstance(): ReactFlowInstance<
  AgentFlowNode,
  AgentFlowEdge
> | null {
  return instance
}
