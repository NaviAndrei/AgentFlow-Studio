import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function GuardrailNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.guardrail}
      data={data}
      selected={selected}
      extraOutputs={['pass', 'fail']}
    >
      <Field k="check" v={data.checkType ?? 'keyword'} />
    </NodeShell>
  )
}
