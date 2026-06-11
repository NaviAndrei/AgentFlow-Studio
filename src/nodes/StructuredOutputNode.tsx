import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function StructuredOutputNode({
  id,
  data,
  selected,
}: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.structuredOutput}
      data={data}
      selected={selected}
    >
      <Field k="model" v={data.pydanticModel ?? 'OutputModel'} />
    </NodeShell>
  )
}
