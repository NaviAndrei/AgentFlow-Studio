import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function LongTermStoreNode({
  id,
  data,
  selected,
}: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.longTermStore}
      data={data}
      selected={selected}
    >
      <Field k="op" v={data.storeOperation ?? 'read'} />
      <Field k="ns" v={data.namespace ?? 'user_memories'} />
    </NodeShell>
  )
}
