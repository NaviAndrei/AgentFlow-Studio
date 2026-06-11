import { Keyboard, X } from 'lucide-react'
import { useBlueprintStore } from '../store/blueprintStore'

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Delete / Backspace', description: 'Delete selected nodes and edges' },
  { keys: 'Ctrl+Z', description: 'Undo (last 50 changes)' },
  { keys: 'Ctrl+Shift+Z / Ctrl+Y', description: 'Redo' },
  { keys: 'Ctrl+D', description: 'Duplicate selected nodes' },
  { keys: 'Ctrl+A', description: 'Select all nodes' },
  { keys: 'Ctrl+E', description: 'Open Python export' },
  { keys: 'Escape', description: 'Deselect all / close modal' },
  { keys: 'Space + drag', description: 'Pan the canvas' },
  { keys: '/', description: 'Quick-add a node' },
  { keys: 'Double-click node title', description: 'Rename node inline' },
  { keys: 'Double-click edge', description: 'Edit edge label' },
]

export function ShortcutsModal() {
  const shortcutsOpen = useBlueprintStore((s) => s.shortcutsOpen)
  const setShortcutsOpen = useBlueprintStore((s) => s.setShortcutsOpen)

  if (!shortcutsOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={() => setShortcutsOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-100">
            <Keyboard size={16} className="text-accent" />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setShortcutsOpen(false)}
            className="rounded-md p-1 text-gray-400 hover:bg-surface-2 hover:text-white"
            aria-label="Close shortcuts"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <kbd className="rounded border border-white/10 bg-surface-2 px-1.5 py-0.5 text-[10px] text-accent">
                {s.keys}
              </kbd>
              <span className="text-gray-400">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
