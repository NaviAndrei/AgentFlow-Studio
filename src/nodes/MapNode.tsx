import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function MapNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.map} data={data} selected={selected}>
      <Field k="over" v={data.inputExpression ?? 'items'} />
      <Field k="parallel" v={String(data.maxParallel ?? 10)} />
    </NodeShell>
  )
}
