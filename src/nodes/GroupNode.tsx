import { useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { useCanvasStore } from '../store/canvasStore'

export function GroupNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const [editingLabel, setEditingLabel] = useState(false)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const toggleGroupCollapse = useCanvasStore((s) => s.toggleGroupCollapse)
  const childCount = useCanvasStore(
    (s) => s.nodes.filter((n) => n.parentId === id).length,
  )
  const collapsed = data.collapsed === true

  const label = editingLabel ? (
    <input
      autoFocus
      className="nodrag w-32 rounded bg-black/30 px-1 text-xs font-semibold text-accent outline-none"
      value={data.label}
      onChange={(e) => updateNodeData(id, { label: e.target.value })}
      onBlur={() => setEditingLabel(false)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' || e.key === 'Escape') setEditingLabel(false)
      }}
    />
  ) : (
    <span
      className="truncate text-xs font-semibold text-accent"
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditingLabel(true)
      }}
    >
      {data.label}
    </span>
  )

  if (collapsed) {
    return (
      <div
        className={`flex h-full w-full items-center gap-2 rounded-lg border-2 border-dashed bg-surface-2/90 px-3 shadow-lg ${
          selected ? 'border-accent' : 'border-accent/50'
        }`}
      >
        {label}
        <span className="ml-auto whitespace-nowrap text-[10px] text-gray-500">
          {childCount} node{childCount === 1 ? '' : 's'}
        </span>
        <button
          onClick={() => toggleGroupCollapse(id)}
          title="Expand group"
          className="nodrag rounded p-0.5 text-gray-400 hover:bg-surface hover:text-accent"
        >
          <ChevronsUpDown size={13} />
        </button>
      </div>
    )
  }

  return (
    <div
      className={`h-full w-full rounded-xl border-2 border-dashed bg-surface/30 ${
        selected ? 'border-accent' : 'border-accent/40'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {label}
        <span className="text-[10px] text-gray-500">
          {childCount} node{childCount === 1 ? '' : 's'}
        </span>
        <button
          onClick={() => toggleGroupCollapse(id)}
          title="Collapse group"
          className="nodrag ml-auto rounded p-0.5 text-gray-400 hover:bg-surface-2 hover:text-accent"
        >
          <ChevronsDownUp size={13} />
        </button>
      </div>
    </div>
  )
}
