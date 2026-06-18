import { create } from 'zustand'
import type { RunRecord } from '../types'

const MAX_RUNS = 100

interface RunHistoryState {
  runs: RunRecord[]
  panelOpen: boolean
  searchQuery: string
  filterStatus: 'all' | 'done' | 'error' | 'stopped'
  filterMode: 'all' | 'simulated' | 'live'
  selectedRunId: string | null
  compareRunIds: [string, string] | null

  setPanelOpen: (open: boolean) => void
  addRun: (run: RunRecord) => void
  deleteRun: (id: string) => void
  clearAll: () => void
  setSearchQuery: (q: string) => void
  setFilterStatus: (f: RunHistoryState['filterStatus']) => void
  setFilterMode: (f: RunHistoryState['filterMode']) => void
  setSelectedRunId: (id: string | null) => void
  setCompareRunIds: (ids: [string, string] | null) => void
}

export const useRunHistoryStore = create<RunHistoryState>((set, get) => ({
  runs: [],
  panelOpen: false,
  searchQuery: '',
  filterStatus: 'all',
  filterMode: 'all',
  selectedRunId: null,
  compareRunIds: null,

  setPanelOpen: (panelOpen) => set({ panelOpen }),
  addRun: (run) => set({ runs: [run, ...get().runs].slice(0, MAX_RUNS) }),
  deleteRun: (id) =>
    set({
      runs: get().runs.filter((r) => r.id !== id),
      selectedRunId: get().selectedRunId === id ? null : get().selectedRunId,
    }),
  clearAll: () => set({ runs: [], selectedRunId: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setFilterMode: (filterMode) => set({ filterMode }),
  setSelectedRunId: (selectedRunId) => set({ selectedRunId }),
  setCompareRunIds: (compareRunIds) => set({ compareRunIds }),
}))
