import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function CodeExecutorNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.codeExecutor}
      data={data}
      selected={selected}
    >
      <Field k="lang" v={data.language ?? 'python'} />
      <Field k="timeout" v={`${data.timeout ?? 30}s`} />
      <Field k="network" v={data.allowNetworkAccess ? 'on' : 'off'} />
    </NodeShell>
  )
}
