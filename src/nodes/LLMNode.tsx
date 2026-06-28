import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function LLMNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  return (
    <NodeShell id={id} meta={NODE_META.llm} data={data} selected={selected}>
      <Field k="model" v={data.model ?? '—'} />
      <Field k="temp" v={(data.temperature ?? 0.7).toFixed(1)} />
      {data.modelOverride && (
        <span className="mt-1 inline-block rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
          {data.modelOverride}
        </span>
      )}
    </NodeShell>
  )
}
