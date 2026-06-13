import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function EvaluatorNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const branches = (data.evalBranches ?? ['pass', 'fail']).filter(Boolean)
  return (
    <NodeShell
      id={id}
      meta={NODE_META.evaluator}
      data={data}
      selected={selected}
      extraOutputs={branches}
    >
      <div className="truncate text-gray-500">
        type:{' '}
        <span className="text-gray-400">{data.scoreType ?? 'pass_fail'}</span>
      </div>
      {branches.length > 0 ? (
        branches.map((b) => (
          <div key={b} className="truncate text-gray-400">
            <span className="text-gray-500">→</span> {b}
          </div>
        ))
      ) : (
        <div className="text-gray-500">no branches</div>
      )}
    </NodeShell>
  )
}
