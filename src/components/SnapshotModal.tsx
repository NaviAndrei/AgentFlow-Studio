import { useState } from 'react'
import { Bookmark, RotateCcw, Trash2 } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useSnapshotStore } from '../store/snapshotStore'
import { useCanvasStore } from '../store/canvasStore'
import { useToastStore } from '../store/toastStore'
import { Modal } from './Modal'

const MAX_SLOTS = 10

export function SnapshotModal() {
  const snapshotOpen = useUIStore((s) => s.snapshotOpen)
  const setSnapshotOpen = useUIStore((s) => s.setSnapshotOpen)
  const snapshots = useSnapshotStore((s) => s.snapshots)
  const saveSnapshot = useSnapshotStore((s) => s.saveSnapshot)
  const restoreSnapshot = useSnapshotStore((s) => s.restoreSnapshot)
  const deleteSnapshot = useSnapshotStore((s) => s.deleteSnapshot)
  const hasNodes = useCanvasStore((s) => s.nodes.length > 0)
  const pushToast = useToastStore((s) => s.pushToast)
  const [name, setName] = useState('')

  const trimmed = name.trim()
  const sorted = [...snapshots].sort((a, b) => b.savedAt.localeCompare(a.savedAt))

  const handleSave = () => {
    if (trimmed === '' || !hasNodes) return
    saveSnapshot(trimmed)
    setName('')
    pushToast(`Snapshot '${trimmed}' saved`)
  }

  const handleRestore = (id: string, snapName: string) => {
    restoreSnapshot(id)
    setSnapshotOpen(false)
    pushToast(`Snapshot '${snapName}' restored`)
  }

  const handleDelete = (id: string) => {
    deleteSnapshot(id)
    pushToast('Snapshot deleted')
  }

  return (
    <Modal
      open={snapshotOpen}
      onClose={() => setSnapshotOpen(false)}
      title="Snapshot Manager"
      icon={Bookmark}
      maxWidth="lg"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
            placeholder="Name this snapshot…"
            className="flex-1 rounded-md border border-white/10 bg-surface-2 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-accent/50"
          />
          <button
            onClick={handleSave}
            disabled={trimmed === '' || !hasNodes}
            className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Current
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-500">
            No snapshots yet. Save the current canvas to create one.
          </p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {sorted.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-surface-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-200">{snap.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(snap.savedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleRestore(snap.id, snap.name)}
                    title="Restore this snapshot"
                    className="rounded-md border border-white/10 p-1.5 text-gray-300 transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(snap.id)}
                    title="Delete this snapshot"
                    className="rounded-md border border-white/10 p-1.5 text-gray-300 transition-colors hover:border-red-500/50 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-right text-[10px] text-gray-600">
          {snapshots.length} / {MAX_SLOTS} slots used
        </p>
      </div>
    </Modal>
  )
}
