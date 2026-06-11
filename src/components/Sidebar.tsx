import type { DragEvent } from 'react'
import { NODE_META, PALETTE } from '../nodes'
import type { AgentFlowNodeType } from '../types'

function PaletteItem({ type }: { type: AgentFlowNodeType }) {
  const meta = NODE_META[type]
  const Icon = meta.icon

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/agentflow', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex cursor-grab items-center gap-2.5 rounded-md border border-white/10 bg-surface-2 px-2.5 py-2 transition-colors hover:border-accent/50 active:cursor-grabbing"
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
        style={{ backgroundColor: meta.color }}
      >
        <Icon size={13} className="text-white" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs text-gray-200">{meta.label}</div>
        <div className="truncate text-[10px] text-gray-500">{meta.description}</div>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="w-[260px] shrink-0 overflow-y-auto border-r border-white/10 bg-surface p-3">
      <p className="mb-3 text-[10px] uppercase tracking-wider text-gray-500">
        Drag nodes onto the canvas
      </p>
      {PALETTE.map((group) => (
        <section key={group.title} className="mb-4">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {group.title}
          </h2>
          <div className="space-y-1.5">
            {group.types.map((type) => (
              <PaletteItem key={type} type={type} />
            ))}
          </div>
        </section>
      ))}
    </aside>
  )
}
