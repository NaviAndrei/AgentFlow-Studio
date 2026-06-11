import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { NodeShell } from './NodeShell'
import { NODE_META } from './registry'

export function MCPServerNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const tools = (data.mcpTools ?? []).filter(Boolean)
  return (
    <NodeShell
      id={id}
      meta={NODE_META.mcpServer}
      data={data}
      selected={selected}
      extraOutputs={tools.length > 0 ? tools : undefined}
    >
      <div className="truncate text-gray-400">
        MCP: {tools.length} tool{tools.length === 1 ? '' : 's'}
      </div>
      {tools.map((tool) => (
        <div key={tool} className="truncate text-right text-[10px] text-gray-500">
          {tool} →
        </div>
      ))}
    </NodeShell>
  )
}
