import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Search } from 'lucide-react'
import { NODE_META, PALETTE } from '../nodes'
import { useBlueprintStore } from '../store/blueprintStore'
import { useCanvasStore } from '../store/canvasStore'
import type { AgentFlowNodeType } from '../types'

const TABS: { label: string; group: string | null }[] = [
  { label: 'All', group: null },
  { label: 'Core', group: 'Core' },
  { label: 'Flow Control', group: 'Flow Control' },
  { label: 'Multi-Agent', group: 'Multi-Agent' },
  { label: 'Annotation', group: 'Annotation' },
]

function QuickAddInner() {
  const setQuickAddOpen = useBlueprintStore((s) => s.setQuickAddOpen)
  const addNode = useCanvasStore((s) => s.addNode)
  const { screenToFlowPosition } = useReactFlow()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(0)

  const q = query.toLowerCase().trim()
  const items: AgentFlowNodeType[] = PALETTE.filter(
    (group) => tab === null || group.title === tab,
  )
    .flatMap((group) => group.types)
    .filter((type) => {
      const meta = NODE_META[type]
      return (
        q === '' ||
        meta.label.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q)
      )
    })
  const highlightIndex = Math.min(highlight, Math.max(items.length - 1, 0))

  const addAtViewportCenter = (type: AgentFlowNodeType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addNode(type, position)
    setQuickAddOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[18vh]"
      onClick={() => setQuickAddOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick-add a node"
        className="w-full max-w-md rounded-xl border border-white/10 bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
          <Search size={14} className="shrink-0 text-gray-500" />
          <input
            autoFocus
            placeholder="Add a node…"
            className="w-full bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-600"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlight(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuickAddOpen(false)
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlight((h) => Math.min(h + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlight((h) => Math.max(h - 1, 0))
              } else if (e.key === 'Enter') {
                const type = items[highlightIndex]
                if (type) addAtViewportCenter(type)
              }
            }}
          />
        </div>
        <div className="flex gap-1 border-b border-white/10 px-2 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => {
                setTab(t.group)
                setHighlight(0)
              }}
              className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                tab === t.group
                  ? 'bg-accent/15 text-accent'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-2 py-3 text-xs text-gray-500">No matching nodes.</p>
          )}
          {items.map((type, index) => {
            const meta = NODE_META[type]
            const Icon = meta.icon
            return (
              <button
                key={type}
                onClick={() => addAtViewportCenter(type)}
                onMouseEnter={() => setHighlight(index)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                  index === highlightIndex ? 'bg-surface-2' : ''
                }`}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                  style={{ backgroundColor: meta.color }}
                >
                  <Icon size={13} className="text-white" />
                </span>
                <span className="text-xs text-gray-200">{meta.label}</span>
                <span className="ml-auto truncate text-[10px] text-gray-500">
                  {meta.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function QuickAddPopup() {
  const quickAddOpen = useBlueprintStore((s) => s.quickAddOpen)
  // Remount the inner component each time it opens so query/tab state resets.
  if (!quickAddOpen) return null
  return <QuickAddInner />
}
