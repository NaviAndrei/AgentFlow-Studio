import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function SupervisorNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.supervisor} data={data} selected={selected}>
      <div className="truncate text-gray-500">
        {data.description ?? 'Routes tasks to worker agents'}
      </div>
    </NodeShell>
  )
}
