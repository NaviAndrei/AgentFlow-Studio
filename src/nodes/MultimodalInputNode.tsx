import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function MultimodalInputNode({
  id,
  data,
  selected,
}: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell
      id={id}
      meta={NODE_META.multimodalInput}
      data={data}
      selected={selected}
    >
      <Field k="type" v={data.inputType ?? 'image'} />
      <Field k="encoding" v={data.encoding ?? 'url'} />
    </NodeShell>
  )
}
