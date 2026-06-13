import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function JoinNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.join} data={data} selected={selected}>
      <Field k="wait" v="all branches" />
      <Field k="merge" v={data.mergeStrategy ?? 'concat'} />
    </NodeShell>
  )
}
