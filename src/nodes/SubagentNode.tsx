import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function SubagentNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.subagent}
      data={data}
      selected={selected}
    >
      <Field k="role" v={data.role ?? 'worker'} />
      <Field k="iter" v={String(data.maxIterations ?? 5)} />
    </NodeShell>
  )
}
