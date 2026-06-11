import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function ToolNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.tool} data={data} selected={selected}>
      <Field k="name" v={data.toolName ?? 'my_tool'} />
      <div className="truncate text-gray-500">{data.description ?? ''}</div>
    </NodeShell>
  )
}
