import { LayoutTemplate, MousePointerClick, PanelLeft, Workflow } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '/', description: 'Quick-add a node' },
  { keys: 'Ctrl+Z', description: 'Undo' },
  { keys: 'Ctrl+D', description: 'Duplicate selection' },
  { keys: 'Ctrl+E', description: 'Export Python' },
]

/**
 * First-run hint shown over the empty canvas; disappears as soon as the
 * first node lands. Pointer events pass through outside the card so
 * drag-and-drop from the palette still works everywhere.
 */
export function WelcomeOverlay() {
  const isEmpty = useCanvasStore((s) => s.nodes.length === 0)
  const simActive = useSimulationStore((s) => s.isActive)
  const setGalleryOpen = useUIStore((s) => s.setGalleryOpen)
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen)

  if (!isEmpty || simActive) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-white/10 bg-surface/95 p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <Workflow size={18} className="text-accent" />
          <h2 className="text-sm font-bold text-gray-100">
            Welcome to AgentFlow <span className="text-accent">Studio</span>
          </h2>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-gray-500">
          Design AI agent graphs visually, simulate them, and export LangGraph
          Python. Start with one of these:
        </p>
        <div className="mb-4 space-y-1.5">
          <button
            onClick={() => setGalleryOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 px-3 py-2.5 text-left text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
          >
            <LayoutTemplate size={14} className="shrink-0 text-accent" />
            <span>
              <span className="font-semibold">Browse Blueprints</span>
              <span className="block text-[10px] text-gray-500">
                Load a ready-made pattern like ReAct or RAG
              </span>
            </span>
          </button>
          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 px-3 py-2.5 text-left text-xs text-gray-300 transition-colors hover:border-accent/50 hover:text-white"
          >
            <MousePointerClick size={14} className="shrink-0 text-accent" />
            <span>
              <span className="font-semibold">Add a node</span>
              <span className="block text-[10px] text-gray-500">
                Press / anywhere to quick-add by name
              </span>
            </span>
          </button>
          <div className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-left text-xs text-gray-400">
            <PanelLeft size={14} className="shrink-0 text-accent" />
            <span>
              <span className="font-semibold">Drag from the left panel</span>
              <span className="block text-[10px] text-gray-500">
                Drop node types anywhere on the canvas
              </span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center gap-2 text-[10px]">
              <kbd className="rounded border border-white/10 bg-surface-2 px-1.5 py-0.5 text-accent">
                {s.keys}
              </kbd>
              <span className="text-gray-500">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
