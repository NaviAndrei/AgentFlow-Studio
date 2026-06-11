import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function LoopNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.loop} data={data} selected={selected}>
      <Field k="until" v={data.loopCondition ?? '—'} />
    </NodeShell>
  )
}
