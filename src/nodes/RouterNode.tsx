import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function RouterNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const routes = (data.routes ?? []).filter(Boolean)
  return (
    <NodeShell
      id={id}
      meta={NODE_META.router}
      data={data}
      selected={selected}
      extraOutputs={routes}
    >
      {routes.length > 0 ? (
        routes.map((r) => (
          <div key={r} className="truncate text-gray-400">
            <span className="text-gray-500">→</span> {r}
          </div>
        ))
      ) : (
        <div className="text-gray-500">no routes</div>
      )}
    </NodeShell>
  )
}
