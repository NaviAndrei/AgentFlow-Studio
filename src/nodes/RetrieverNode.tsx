import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function RetrieverNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.retriever} data={data} selected={selected}>
      <div className="truncate text-gray-400">
        kb: {data.knowledgeBase ?? 'docs'} · top-k: {data.topK ?? 4}
      </div>
    </NodeShell>
  )
}
