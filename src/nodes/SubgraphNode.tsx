import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function SubgraphNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const ref = (data.subgraphRef ?? '').trim() || 'unset'
  return (
    <NodeShell
      id={id}
      meta={NODE_META.subgraph}
      data={data}
      selected={selected}
    >
      <Field k="ref" v={ref} />
      {data.subgraphSummary && (
        <div className="truncate text-gray-500">
          {data.subgraphSummary}
        </div>
      )}
    </NodeShell>
  )
}
