import type { DragEvent } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NODE_META, PALETTE } from '../nodes'
import { useUIStore } from '../store/uiStore'
import { HintIcon } from './HintIcon'
import { HINTS } from '../data/hints'
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
      className="relative flex cursor-grab items-center gap-2.5 rounded-md border border-white/10 bg-surface-2 px-2.5 py-2 transition-colors hover:border-accent/50 active:cursor-grabbing"
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
      <span className="absolute right-1.5 top-1.5">
        <HintIcon text={HINTS.nodes[type]} />
      </span>
    </div>
  )
}

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  if (!sidebarOpen) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center border-r border-white/10 bg-surface py-2">
        <button
          onClick={toggleSidebar}
          title="Show node palette"
          aria-label="Show node palette"
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-surface-2 hover:text-white"
        >
          <PanelLeftOpen size={15} />
        </button>
      </div>
    )
  }

  return (
    <aside className="w-[260px] shrink-0 overflow-y-auto border-r border-white/10 bg-surface p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">
          Drag nodes onto the canvas
        </p>
        <button
          onClick={toggleSidebar}
          title="Collapse palette"
          aria-label="Collapse palette"
          className="rounded-md p-1 text-gray-500 transition-colors hover:bg-surface-2 hover:text-white"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>
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
