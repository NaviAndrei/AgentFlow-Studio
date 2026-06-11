import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function MemoryNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.memory} data={data} selected={selected}>
      <Field k="type" v={data.memoryType ?? 'short-term'} />
    </NodeShell>
  )
}
