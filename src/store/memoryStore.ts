// Session-scoped, in-memory store backing the longTermStore and memoryWriter
// live nodes. No IndexedDB/localStorage — cleared alongside the canvas (see
// canvasStore.clearCanvas) and naturally on page reload.
import { create } from 'zustand'

interface MemoryState {
  entries: Record<string, string[]>
  write: (key: string, value: string) => void
  read: (key: string) => string[]
  clear: () => void
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
  clear: () => set({ entries: {} }),
}))
