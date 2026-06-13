import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function ComputerUseNode({
  id,
  data,
  selected,
}: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.computerUse}
      data={data}
      selected={selected}
    >
      <Field k="model" v={data.model ?? 'claude-sonnet-4-5'} />
      <Field k="max steps" v={String(data.maxSteps ?? 10)} />
    </NodeShell>
  )
}
