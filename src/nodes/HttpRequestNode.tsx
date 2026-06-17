import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell, Field } from './NodeShell'
import { NODE_META } from './registry'

export function HttpRequestNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.httpRequest} data={data} selected={selected}>
      <Field k="method" v={data.httpMethod ?? 'GET'} />
      <div className="truncate text-gray-500">{data.httpUrl || 'no url'}</div>
    </NodeShell>
  )
}
