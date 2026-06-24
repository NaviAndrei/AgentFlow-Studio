import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'
import { scoreCommand } from '../utils/commandPalette'
import type { PaletteCommand } from '../utils/commandPalette'
import { ConfirmDialog } from './Modal'

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const closeAllModals = useUIStore((s) => s.closeAllModals)
  const setSnapshotOpen = useUIStore((s) => s.setSnapshotOpen)
  const galleryOpen = useUIStore((s) => s.galleryOpen)
  const setGalleryOpen = useUIStore((s) => s.setGalleryOpen)
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen)
  const setExportOpen = useUIStore((s) => s.setExportOpen)
  const toggleMinimap = useUIStore((s) => s.toggleMinimap)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const nodes = useCanvasStore((s) => s.nodes)
  const history = useCanvasStore((s) => s.history)
  const future = useCanvasStore((s) => s.future)
  const validationIssues = useCanvasStore((s) => s.validationIssues)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const selectAll = useCanvasStore((s) => s.selectAll)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)

  const simulationActive = useSimulationStore((s) => s.isActive)
  const liveMode = useSimulationStore((s) => s.liveMode)
  const startSimulation = useSimulationStore((s) => s.start)
  const stopSimulation = useSimulationStore((s) => s.stop)

  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<PaletteCommand[]>(() => {
    const hasErrors = validationIssues.some((i) => i.level === 'error')
    return [
      {
        id: 'clear-canvas',
        label: 'Clear Canvas',
        keywords: ['new', 'reset'],
        group: 'Canvas',
        disabled: nodes.length === 0,
        action: () => setConfirmClearOpen(true),
      },
      {
        id: 'select-all',
        label: 'Select All',
        keywords: [],
        group: 'Canvas',
        shortcut: 'Ctrl+A',
        disabled: nodes.length === 0,
        action: selectAll,
      },
      {
        id: 'undo',
        label: 'Undo',
        keywords: [],
        group: 'Canvas',
        shortcut: 'Ctrl+Z',
        disabled: history.length === 0,
        action: () => undo(),
      },
      {
        id: 'redo',
        label: 'Redo',
        keywords: [],
        group: 'Canvas',
        shortcut: 'Ctrl+Shift+Z',
        disabled: future.length === 0,
        action: () => redo(),
      },
      {
        id: 'toggle-minimap',
        label: 'Toggle Minimap',
        keywords: ['map'],
        group: 'View',
        action: toggleMinimap,
      },
      {
        id: 'toggle-sidebar',
        label: 'Toggle Sidebar',
        keywords: ['palette'],
        group: 'View',
        action: toggleSidebar,
      },
      {
        id: 'open-gallery',
        label: 'Open Blueprint Gallery',
        keywords: ['blueprint', 'template'],
        group: 'View',
        shortcut: 'G',
        action: () => setGalleryOpen(!galleryOpen),
      },
      {
        id: 'open-shortcuts',
        label: 'Keyboard Shortcuts',
        keywords: ['help'],
        group: 'View',
        shortcut: '?',
        action: () => setShortcutsOpen(true),
      },
      {
        id: 'open-snapshots',
        label: 'Snapshot Manager',
        keywords: ['save', 'load'],
        group: 'Snapshots',
        shortcut: 'Ctrl+Shift+S',
        action: () => setSnapshotOpen(true),
      },
      {
        id: 'save-snapshot',
        label: 'Save Snapshot…',
        keywords: [],
        group: 'Snapshots',
        disabled: nodes.length === 0,
        action: () => setSnapshotOpen(true),
      },
      {
        id: 'export-python',
        label: 'Export Python (LangGraph)',
        keywords: ['langgraph', 'code'],
        group: 'Export',
        shortcut: 'Ctrl+E',
        disabled: hasErrors || liveMode,
        action: () => setExportOpen(true),
      },
      {
        id: 'start-stop-sim',
        label: 'Start / Stop Simulation',
        keywords: ['run', 'simulate'],
        group: 'Simulation',
        shortcut: 'Ctrl+R',
        disabled: nodes.length === 0,
        action: () => (simulationActive ? stopSimulation() : startSimulation()),
      },
    ]
  }, [
    nodes.length,
    history.length,
    future.length,
    validationIssues,
    liveMode,
    simulationActive,
    galleryOpen,
    setConfirmClearOpen,
    selectAll,
    undo,
    redo,
    toggleMinimap,
    toggleSidebar,
    setGalleryOpen,
    setShortcutsOpen,
    setSnapshotOpen,
    setExportOpen,
    stopSimulation,
    startSimulation,
  ])

  const filtered = useMemo(() => {
    return commands
      .map((cmd) => ({ cmd, score: scoreCommand(cmd, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) =>
        a.cmd.group === b.cmd.group
          ? b.score - a.score
          : a.cmd.group.localeCompare(b.cmd.group),
      )
      .map((r) => r.cmd)
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlighted(0)
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeAllModals()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, closeAllModals])

  if (!open && !confirmClearOpen) return null

  const execute = (cmd: PaletteCommand) => {
    if (cmd.disabled) return
    closeAllModals()
    cmd.action()
  }

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const cmd = filtered[highlighted]
      if (cmd) execute(cmd)
    }
  }

  let lastGroup: string | null = null

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 px-6 pt-[20vh]"
          onClick={() => closeAllModals()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
            className="h-fit w-full max-w-lg rounded-xl border border-white/10 bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
              <Search size={14} className="text-gray-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Type a command…"
                className="w-full bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-500"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-500">No matching commands.</p>
              ) : (
                filtered.map((cmd, i) => {
                  const showGroupHeader = cmd.group !== lastGroup
                  lastGroup = cmd.group
                  return (
                    <div key={cmd.id}>
                      {showGroupHeader && (
                        <p className="mt-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 first:mt-0">
                          {cmd.group}
                        </p>
                      )}
                      <button
                        onClick={() => execute(cmd)}
                        onMouseEnter={() => setHighlighted(i)}
                        disabled={cmd.disabled}
                        className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                          cmd.disabled
                            ? 'cursor-not-allowed text-gray-600'
                            : i === highlighted
                              ? 'bg-accent/15 text-accent'
                              : 'text-gray-300 hover:bg-surface-2'
                        }`}
                      >
                        <span>{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="text-[10px] text-gray-500">{cmd.shortcut}</kbd>
                        )}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear canvas?"
        message="Clear canvas? This will remove all nodes and edges. This action cannot be undone."
        confirmLabel="Clear"
        onConfirm={() => {
          clearCanvas()
          setConfirmClearOpen(false)
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </>
  )
}
