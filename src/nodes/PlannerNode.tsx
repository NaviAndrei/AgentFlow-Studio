import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function PlannerNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.planner}
      data={data}
      selected={selected}
    >
      <Field k="max tasks" v={String(data.maxTasks ?? 5)} />
    </NodeShell>
  )
}
