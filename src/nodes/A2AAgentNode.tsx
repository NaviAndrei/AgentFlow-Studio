import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function A2AAgentNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.a2aAgent}
      data={data}
      selected={selected}
    >
      <Field k="agent" v={data.agentName ?? 'Remote Agent'} />
      <div className="truncate text-gray-500">
        {data.agentUrl ?? 'no endpoint'}
      </div>
    </NodeShell>
  )
}
