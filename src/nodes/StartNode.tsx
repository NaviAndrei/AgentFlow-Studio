import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function StartNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const vars = (data.inputVariables ?? []).filter(Boolean)
  return (
    <NodeShell id={id} meta={NODE_META.start} data={data} selected={selected} hasInput={false}>
      <Field k="inputs" v={vars.length > 0 ? vars.join(', ') : 'none'} />
    </NodeShell>
  )
}
