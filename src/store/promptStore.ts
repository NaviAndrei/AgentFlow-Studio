import { create } from 'zustand'
import type { PromptEntry, PromptVersion } from '../types'

interface PromptState {
  entries: PromptEntry[]
  registryOpen: boolean

  setRegistryOpen: (open: boolean) => void
  addEntry: (name: string, category: PromptEntry['category'], content: string) => PromptEntry
  deleteEntry: (id: string) => void
  renameEntry: (id: string, name: string) => void
  addVersion: (entryId: string, content: string, note?: string) => void
  pinVersion: (entryId: string, versionId: string) => void
  deleteVersion: (entryId: string, versionId: string) => void
  getActiveContent: (entryId: string) => string | undefined
}

export const usePromptStore = create<PromptState>((set, get) => ({
  entries: [],
  registryOpen: false,

  setRegistryOpen: (registryOpen) => set({ registryOpen }),

  addEntry: (name, category, content) => {
    const versionId = crypto.randomUUID()
    const entry: PromptEntry = {
      id: crypto.randomUUID(),
      name,
      category,
      versions: [{ id: versionId, content, createdAt: Date.now() }],
      pinnedVersionId: versionId,
    }
    set({ entries: [...get().entries, entry] })
    return entry
  },

  deleteEntry: (id) => set({ entries: get().entries.filter((e) => e.id !== id) }),

  renameEntry: (id, name) =>
    set({
      entries: get().entries.map((e) => (e.id === id ? { ...e, name } : e)),
    }),

  addVersion: (entryId, content, note) =>
    set({
      entries: get().entries.map((e) => {
        if (e.id !== entryId) return e
        const v: PromptVersion = { id: crypto.randomUUID(), content, createdAt: Date.now(), note }
        return { ...e, versions: [...e.versions, v], pinnedVersionId: v.id }
      }),
    }),

  pinVersion: (entryId, versionId) =>
    set({
      entries: get().entries.map((e) =>
        e.id === entryId ? { ...e, pinnedVersionId: versionId } : e,
      ),
    }),

  deleteVersion: (entryId, versionId) =>
    set({
      entries: get().entries.map((e) => {
        if (e.id !== entryId || e.versions.length <= 1) return e
        const versions = e.versions.filter((v) => v.id !== versionId)
        const pinnedVersionId =
          e.pinnedVersionId === versionId
            ? versions[versions.length - 1].id
            : e.pinnedVersionId
        return { ...e, versions, pinnedVersionId }
      }),
    }),

  getActiveContent: (entryId) => {
    const entry = get().entries.find((e) => e.id === entryId)
    if (!entry) return undefined
    return entry.versions.find((v) => v.id === entry.pinnedVersionId)?.content
  },
}))
