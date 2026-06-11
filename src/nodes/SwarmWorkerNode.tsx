import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function SwarmWorkerNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.swarmWorker} data={data} selected={selected}>
      <div className="truncate text-gray-500">
        {data.description ?? 'Peer agent with handoff support'}
      </div>
    </NodeShell>
  )
}
