// Session-scoped, in-memory store backing the longTermStore and memoryWriter
// live nodes. No IndexedDB/localStorage — cleared alongside the canvas (see
// canvasStore.clearCanvas) and naturally on page reload.
import { create } from 'zustand'
import type { MemorySearchResult, VectorEntry } from '../types'
import { semanticSearch, textToVector } from '../utils/vectorMemory'

interface MemoryState {
  entries: Record<string, string[]>
  write: (key: string, value: string) => void
  read: (key: string) => string[]
  clear: () => void
  /** Namespaced vector store: each write also lands here with a hash embedding. */
  namespaces: Record<string, VectorEntry[]>
  writeEntry: (namespace: string, text: string, metadata?: Record<string, unknown>) => void
  readEntries: (namespace: string, query: string, topK: number) => MemorySearchResult[]
  clearNamespace: (namespace: string) => void
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  entries: {},
  write: (key, value) =>
    set({
      entries: {
        ...get().entries,
        [key]: [...(get().entries[key] ?? []), value],
      },
    }),
  read: (key) => get().entries[key] ?? [],
  clear: () => set({ entries: {}, namespaces: {} }),

  namespaces: {},
  writeEntry: (namespace, text, metadata) => {
    const entry: VectorEntry = {
      id: crypto.randomUUID(),
      text,
      embedding: textToVector(text),
      metadata,
      createdAt: Date.now(),
    }
    set({
      namespaces: {
        ...get().namespaces,
        [namespace]: [...(get().namespaces[namespace] ?? []), entry],
      },
    })
  },
  readEntries: (namespace, query, topK) =>
    semanticSearch(query, get().namespaces[namespace] ?? [], topK),
  clearNamespace: (namespace) => {
    const next = { ...get().namespaces }
    delete next[namespace]
    set({ namespaces: next })
  },
}))
