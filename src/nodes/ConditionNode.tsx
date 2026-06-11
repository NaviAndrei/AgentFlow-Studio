import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function ConditionNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const branches = (data.branches ?? []).filter(Boolean)
  return (
    <NodeShell id={id} meta={NODE_META.condition} data={data} selected={selected}>
      {branches.length > 0 ? (
        branches.map((b, i) => (
          <div key={i} className="truncate text-gray-400">
            <span className="text-gray-500">{i === 0 ? 'if' : i === branches.length - 1 ? 'else' : 'elif'}</span>{' '}
            {b}
          </div>
        ))
      ) : (
        <div className="text-gray-500">no branches</div>
      )}
    </NodeShell>
  )
}
