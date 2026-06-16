import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react'
import { usePromptStore } from '../store/promptStore'
import { getRelativeTime, getAbsoluteTime, hasVisibleNote } from '../utils/dateFormat'
import type { PromptEntry } from '../types'

const UNDO_MS = 3000

const CATEGORY_DOT: Record<PromptEntry['category'], string> = {
  system: 'bg-accent',
  user: 'bg-purple-500',
  general: 'bg-gray-500',
}

function EntryRow({ entry }: { entry: PromptEntry }) {
  const [expanded, setExpanded] = useState(false)
  const [addingVersion, setAddingVersion] = useState(false)
  const [versionContent, setVersionContent] = useState('')
  const [versionNote, setVersionNote] = useState('')
  // inline undo state for entry deletion
  const [pendingDelete, setPendingDelete] = useState(false)
  // which version id triggered a "blocked: active" error
  const [blockedVersionId, setBlockedVersionId] = useState<string | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // refs to each Pin button keyed by version id — used for auto-focus on block
  const pinRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const deleteEntry = usePromptStore((s) => s.deleteEntry)
  const pinVersion = usePromptStore((s) => s.pinVersion)
  const deleteVersion = usePromptStore((s) => s.deleteVersion)
  const addVersion = usePromptStore((s) => s.addVersion)

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      if (blockedTimerRef.current) clearTimeout(blockedTimerRef.current)
    }
  }, [])

  const handleDeleteEntryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDelete(true)
    undoTimerRef.current = setTimeout(() => {
      deleteEntry(entry.id)
    }, UNDO_MS)
  }

  const handleUndoDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setPendingDelete(false)
  }

  const handleDeleteVersionClick = (versionId: string, isActive: boolean) => {
    if (isActive) {
      setBlockedVersionId(versionId)
      if (blockedTimerRef.current) clearTimeout(blockedTimerRef.current)
      blockedTimerRef.current = setTimeout(() => setBlockedVersionId(null), UNDO_MS)
      // find next non-active version in display order (reversed) and focus its Pin button
      const reversed = [...entry.versions].reverse()
      const idx = reversed.findIndex((v) => v.id === versionId)
      const neighbor = reversed[idx + 1] ?? reversed[idx - 1]
      if (neighbor) {
        // defer one frame so the error state renders before focus
        setTimeout(() => pinRefs.current.get(neighbor.id)?.focus(), 0)
      }
      return
    }
    deleteVersion(entry.id, versionId)
  }

  const handleAddVersion = () => {
    if (versionContent.trim() === '') return
    addVersion(entry.id, versionContent.trim(), versionNote.trim() || undefined)
    setVersionContent('')
    setVersionNote('')
    setAddingVersion(false)
  }

  return (
    <div
      className={`mb-2 rounded-md border bg-canvas transition-colors duration-200 ${
        pendingDelete ? 'border-red-800/50 bg-red-950/20' : 'border-white/10'
      }`}
    >
      <div
        onClick={() => !pendingDelete && setExpanded((e) => !e)}
        role="button"
        tabIndex={pendingDelete ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !pendingDelete) {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
        aria-expanded={expanded}
        aria-controls={`versions-${entry.id}`}
        className={`flex items-center gap-2 px-2 py-1.5 ${pendingDelete ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {expanded && !pendingDelete ? <ChevronDown size={12} /> : <ChevronRight size={12} className={pendingDelete ? 'opacity-30' : ''} />}
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[entry.category]}`} />
        <span
          className={`flex-1 truncate text-[11px] ${pendingDelete ? 'text-red-300/70 line-through' : 'text-gray-200'}`}
          title={entry.name}
        >
          {entry.name}
        </span>

        {pendingDelete ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] text-red-400">Deleting…</span>
            <button
              onClick={handleUndoDelete}
              className="rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-300 hover:border-red-400 hover:text-red-200"
            >
              Undo
            </button>
          </div>
        ) : (
          <>
            <span className="text-[10px] text-gray-400">
              ({entry.versions.length} version{entry.versions.length === 1 ? '' : 's'})
            </span>
            <button
              onClick={handleDeleteEntryClick}
              aria-label={`Delete prompt "${entry.name}"`}
              className="p-3 text-gray-600 hover:text-red-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>

      {expanded && !pendingDelete && (
        <div id={`versions-${entry.id}`} className="space-y-2 border-t border-white/5 px-2 py-3">
          {[...entry.versions]
            .reverse()
            .sort((a, b) => (b.id === entry.pinnedVersionId ? 1 : 0) - (a.id === entry.pinnedVersionId ? 1 : 0))
            .map((v) => {
            const isActive = v.id === entry.pinnedVersionId
            const isBlocked = blockedVersionId === v.id
            // Visual indicator: left border applies ONLY to active version — not to most recent
            // This provides clear affordance that the active version is the one in use
            return (
              <div
                key={v.id}
                className={`rounded transition-colors duration-150 ${
                  isActive ? 'border-l-2 border-accent pl-3 pr-2 py-2' : 'px-2 py-2'
                } ${isBlocked ? 'bg-red-950/30' : ''}`}
              >
                {/* Header row: timestamp + Active label + action buttons */}
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className="text-[10px] text-gray-500"
                    title={getAbsoluteTime(v.createdAt)}
                  >
                    {getRelativeTime(v.createdAt)}
                  </span>
                  {isActive && (
                    <span className="inline-block rounded border border-accent/50 bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">
                      • Active
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {!isActive && (
                      <button
                        ref={(el) => {
                          if (el) pinRefs.current.set(v.id, el)
                          else pinRefs.current.delete(v.id)
                        }}
                        onClick={() => pinVersion(entry.id, v.id)}
                        aria-label={`Set "${v.note && hasVisibleNote(v.note) ? v.note : 'this version'}" as active version`}
                        title={`Set "${v.note && hasVisibleNote(v.note) ? v.note : 'this version'}" as active version`}
                        className="p-5 rounded text-gray-500 hover:text-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                      >
                        <Pin size={10} />
                      </button>
                    )}
                    {entry.versions.length > 1 && (
                      <button
                        onClick={() => handleDeleteVersionClick(v.id, isActive)}
                        aria-label={
                          isActive
                            ? `Cannot delete active version of "${entry.name}" (${getAbsoluteTime(v.createdAt)}). Activate another version first.`
                            : `Delete version of "${entry.name}" from ${getAbsoluteTime(v.createdAt)}`
                        }
                        aria-disabled={isActive}
                        title={isActive ? 'Cannot delete the active version — set another version as active first.' : undefined}
                        className={`p-5 rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                          isActive
                            ? 'cursor-not-allowed text-red-700/60'
                            : 'text-gray-500 hover:text-red-400'
                        }`}
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Optional note badge — only renders when note has non-whitespace content */}
                {hasVisibleNote(v.note) && (
                  <div className="mb-1.5">
                    <span className="inline-block rounded bg-white/5 px-2 py-0.5 text-[9px] italic text-gray-500">
                      {v.note}
                    </span>
                  </div>
                )}

                {/* Error message for blocked deletion */}
                {isBlocked && (
                  <p className="mb-1.5 text-[10px] text-red-400">
                    Activate another version first, then delete this one.
                  </p>
                )}

                {/* Primary content preview — readable tier */}
                <p
                  className="text-[11px] leading-relaxed text-gray-300"
                  title={v.content}
                >
                  {v.content.slice(0, 120)}
                  {v.content.length > 120 ? '…' : ''}
                </p>
              </div>
            )
          })}

          {addingVersion ? (
            <div className="rounded border border-white/10 bg-surface p-2">
              <textarea
                value={versionContent}
                onChange={(e) => setVersionContent(e.target.value)}
                rows={3}
                placeholder="New version content"
                className="mb-1.5 w-full resize-none rounded border border-white/10 bg-surface-2 px-2 py-1 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
              />
              <input
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="Note (optional)"
                className="mb-1.5 w-full rounded border border-white/10 bg-surface-2 px-2 py-1 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleAddVersion}
                  className="rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-black hover:opacity-90"
                >
                  Save version
                </button>
                <button
                  onClick={() => {
                    setAddingVersion(false)
                    setVersionContent('')
                    setVersionNote('')
                  }}
                  className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-300 hover:border-accent/50 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingVersion(true)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-accent"
            >
              <Plus size={10} />
              Add version
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function PromptRegistryPanel() {
  const open = usePromptStore((s) => s.registryOpen)
  const setOpen = usePromptStore((s) => s.setRegistryOpen)
  const entries = usePromptStore((s) => s.entries)
  const addEntry = usePromptStore((s) => s.addEntry)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<PromptEntry['category']>('system')
  const [content, setContent] = useState('')

  const canAdd = name.trim() !== '' && content.trim() !== ''

  const handleAdd = () => {
    if (!canAdd) return
    addEntry(name.trim(), category, content.trim())
    setName('')
    setContent('')
  }

  return (
    <div
      className={`fixed right-0 top-12 bottom-0 z-20 flex w-96 flex-col border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <BookOpen size={13} className="text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
          Prompt Registry
        </span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
          {entries.length}
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close prompt registry"
          className="ml-auto rounded-md p-3 text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-3 rounded-md border border-white/10 bg-canvas p-2">
          <label className="mb-1 block text-[10px] text-gray-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer support system prompt"
            className="mb-2 w-full rounded border border-white/10 bg-surface px-2 py-1 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
          />
          <label className="mb-1 block text-[10px] text-gray-500">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PromptEntry['category'])}
            className="mb-2 w-full rounded border border-white/10 bg-surface px-2 py-1 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
          >
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="general">General</option>
          </select>
          <label className="mb-1 block text-[10px] text-gray-500">Prompt content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="mb-2 w-full resize-none rounded border border-white/10 bg-surface px-2 py-1 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={10} />
            Add to Registry
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded border border-dashed border-white/10 px-2 py-6 text-center text-[10px] text-gray-600">
            <BookOpen size={20} className="text-gray-700" />
            No prompts yet. Add one above to start building your registry.
          </div>
        ) : (
          entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  )
}
