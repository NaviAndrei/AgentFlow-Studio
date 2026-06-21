import { Keyboard } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { Modal } from './Modal'

interface ShortcutEntry {
  keys: string
  description: string
}

const SECTIONS: { title: string; shortcuts: ShortcutEntry[] }[] = [
  {
    title: 'Canvas',
    shortcuts: [
      { keys: 'Delete / Backspace', description: 'Delete selected nodes and edges' },
      { keys: 'Ctrl+Z', description: 'Undo (last 50 changes)' },
      { keys: 'Ctrl+Shift+Z / Ctrl+Y', description: 'Redo' },
      { keys: 'Ctrl+D', description: 'Duplicate selected nodes' },
      { keys: 'Ctrl+A', description: 'Select all nodes' },
      { keys: 'Escape', description: 'Deselect all / close modal' },
      { keys: 'Space + drag', description: 'Pan the canvas' },
      { keys: 'Double-click node title', description: 'Rename node inline' },
      { keys: 'Double-click edge', description: 'Edit edge label' },
      { keys: 'Ctrl+Shift+S', description: 'Open snapshot manager' },
      { keys: 'Ctrl+K', description: 'Open command palette' },
    ],
  },
  {
    title: 'Simulation',
    shortcuts: [
      { keys: 'Ctrl+R', description: 'Run / stop simulation' },
      { keys: 'Ctrl+E', description: 'Open export (Python / deploy bundle)' },
    ],
  },
  {
    title: 'Nodes',
    shortcuts: [
      { keys: '/', description: 'Quick-add a node' },
      { keys: 'G', description: 'Toggle the Blueprint Gallery' },
    ],
  },
  {
    title: 'Debug',
    shortcuts: [
      { keys: '← / →', description: 'Time Travel: step back / forward (when focused)' },
      { keys: 'Space', description: 'Time Travel: play / pause (when focused)' },
    ],
  },
]

export function ShortcutsModal() {
  const shortcutsOpen = useUIStore((s) => s.shortcutsOpen)
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen)

  return (
    <Modal
      open={shortcutsOpen}
      onClose={() => setShortcutsOpen(false)}
      title="Keyboard Shortcuts"
      icon={Keyboard}
    >
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {section.title}
            </h3>
            <div className="space-y-1.5">
              {section.shortcuts.map((s) => (
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
        ))}
        <p className="text-[10px] text-gray-600">Press ? anywhere to open this panel.</p>
      </div>
    </Modal>
  )
}
