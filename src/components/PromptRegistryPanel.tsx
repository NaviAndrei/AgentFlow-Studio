import { useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react'
import { usePromptStore } from '../store/promptStore'
import type { PromptEntry } from '../types'

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
  const deleteEntry = usePromptStore((s) => s.deleteEntry)
  const pinVersion = usePromptStore((s) => s.pinVersion)
  const deleteVersion = usePromptStore((s) => s.deleteVersion)
  const addVersion = usePromptStore((s) => s.addVersion)

  const handleAddVersion = () => {
    if (versionContent.trim() === '') return
    addVersion(entry.id, versionContent.trim(), versionNote.trim() || undefined)
    setVersionContent('')
    setVersionNote('')
    setAddingVersion(false)
  }

  return (
    <div className="mb-2 rounded-md border border-white/10 bg-canvas">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[entry.category]}`} />
        <span className="flex-1 truncate text-[11px] text-gray-200">{entry.name}</span>
        <span className="text-[10px] text-gray-500">
          ({entry.versions.length} version{entry.versions.length === 1 ? '' : 's'})
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteEntry(entry.id)
          }}
          aria-label="Delete prompt"
          className="text-gray-600 hover:text-red-400"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-1.5 border-t border-white/5 px-2 py-2">
          {[...entry.versions].reverse().map((v) => {
            const isActive = v.id === entry.pinnedVersionId
            return (
              <div
                key={v.id}
                className={`rounded px-2 py-1 ${isActive ? 'border-l-2 border-accent pl-2' : ''}`}
              >
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                  {v.note && <span className="text-[10px] italic text-gray-500">{v.note}</span>}
                  <div className="ml-auto flex items-center gap-1.5">
                    {!isActive && (
                      <button
                        onClick={() => pinVersion(entry.id, v.id)}
                        title="Make active"
                        className="text-gray-500 hover:text-accent"
                      >
                        <Pin size={10} />
                      </button>
                    )}
                    {entry.versions.length > 1 && (
                      <button
                        onClick={() => deleteVersion(entry.id, v.id)}
                        title="Delete version"
                        className="text-gray-500 hover:text-red-400"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="truncate text-[11px] text-gray-400">
                  {v.content.slice(0, 80)}
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
      className={`fixed right-0 top-12 bottom-12 z-20 flex w-96 flex-col border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ${
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
          className="ml-auto rounded-md p-0.5 text-gray-500 hover:text-gray-300"
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
