import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function OutputNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.output} data={data} selected={selected} hasOutput={false}>
      <div className="text-gray-500">Final reply to the user</div>
    </NodeShell>
  )
}
