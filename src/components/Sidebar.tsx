import { useEffect, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { useReactFlow } from '@xyflow/react'
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { NODE_META, PALETTE } from '../nodes'
import { useCanvasStore } from '../store/canvasStore'
import { useUIStore } from '../store/uiStore'
import { HintIcon } from './HintIcon'
import { HINTS } from '../data/hints'
import type { AgentFlowNodeType } from '../types'

function PaletteItem({
  type,
  highlighted,
  onAdd,
  onHover,
}: {
  type: AgentFlowNodeType
  highlighted: boolean
  onAdd: () => void
  onHover: () => void
}) {
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
      onClick={onAdd}
      onMouseEnter={onHover}
      title="Drag onto the canvas, or click to add at center"
      className={`relative flex cursor-grab items-center gap-2.5 rounded-md border bg-surface-2 px-2.5 py-2 transition-colors hover:border-accent/50 active:cursor-grabbing ${
        highlighted ? 'border-accent/50' : 'border-white/10'
      }`}
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
  const addNode = useCanvasStore((s) => s.addNode)
  const { screenToFlowPosition } = useReactFlow()

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [highlight, setHighlight] = useState(0)

  // Debounce filtering by 150ms so typing stays smooth on large palettes.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 150)
    return () => window.clearTimeout(id)
  }, [query])

  const q = debounced.toLowerCase().trim()
  // Groups with their matching types; empty groups are dropped.
  const groups = useMemo(
    () =>
      PALETTE.map((group) => ({
        title: group.title,
        types: group.types.filter((type) => {
          const meta = NODE_META[type]
          return (
            q === '' ||
            meta.label.toLowerCase().includes(q) ||
            meta.description.toLowerCase().includes(q)
          )
        }),
      })).filter((group) => group.types.length > 0),
    [q],
  )
  const flatMatches = useMemo(() => groups.flatMap((g) => g.types), [groups])
  const highlightIndex = Math.min(highlight, Math.max(flatMatches.length - 1, 0))

  const addAtCenter = (type: AgentFlowNodeType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addNode(type, position)
  }

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

      <div className="mb-3 flex items-center gap-2 rounded-md border border-white/10 bg-surface-2 px-2.5 py-1.5">
        <Search size={13} className="shrink-0 text-gray-500" />
        <input
          type="search"
          placeholder="Search nodes…"
          aria-label="Search nodes"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('')
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlight((h) => Math.min(h + 1, flatMatches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((h) => Math.max(h - 1, 0))
            } else if (e.key === 'Enter') {
              const type = flatMatches[highlightIndex]
              if (type) addAtCenter(type)
            }
          }}
          className="w-full bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-600"
        />
      </div>

      {groups.length === 0 && (
        <p className="px-1 py-3 text-[11px] text-gray-600">No matching nodes.</p>
      )}
      {groups.map((group) => (
        <section key={group.title} className="mb-4">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {group.title}
          </h2>
          <div className="space-y-1.5">
            {group.types.map((type) => (
              <PaletteItem
                key={type}
                type={type}
                highlighted={flatMatches[highlightIndex] === type}
                onAdd={() => addAtCenter(type)}
                onHover={() => setHighlight(flatMatches.indexOf(type))}
              />
            ))}
          </div>
        </section>
      ))}
    </aside>
  )
}
