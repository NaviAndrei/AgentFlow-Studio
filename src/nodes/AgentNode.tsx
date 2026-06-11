import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function AgentNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const tools = (data.tools ?? []).filter(Boolean)
  return (
    <NodeShell id={id} meta={NODE_META.agent} data={data} selected={selected}>
      <Field k="tools" v={tools.length > 0 ? tools.join(', ') : 'none'} />
      <Field k="max iter" v={String(data.maxIterations ?? 10)} />
    </NodeShell>
  )
}
