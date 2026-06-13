import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function MemoryWriterNode({
  id,
  data,
  selected,
}: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.memoryWriter}
      data={data}
      selected={selected}
    >
      <Field k="kind" v={data.memoryKind ?? 'episodic'} />
      <Field k="ns" v={data.writeNamespace ?? 'user_memories'} />
    </NodeShell>
  )
}
