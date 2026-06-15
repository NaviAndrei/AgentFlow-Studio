import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { Field, NodeShell } from './NodeShell'
import { NODE_META } from './registry'
import { useSimulationStore } from '../store/simulationStore'

export function RetryNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const attempt = useSimulationStore((s) =>
    s.isActive ? s.retryStatus[id] : undefined,
  )
  const retry = data.retry ?? {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2.0,
    retryOn: ['error'],
  }

  return (
    <NodeShell id={id} meta={NODE_META.retry} data={data} selected={selected}>
      <Field k="max attempts" v={String(retry.maxAttempts)} />
      <Field k="backoff" v={`${retry.backoffMs}ms`} />
      <Field k="retry on" v={retry.retryOn.join(', ')} />
      {attempt && (
        <div className="mt-1 rounded bg-black/20 px-1.5 py-0.5 text-[10px] text-amber-400">
          Attempt {attempt.attempt}/{attempt.max}
        </div>
      )}
    </NodeShell>
  )
}
