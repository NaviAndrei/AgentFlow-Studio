import { create } from 'zustand'
import type { EvalRun, EvalTestCase } from '../types'

interface EvalState {
  testCases: EvalTestCase[]
  runs: EvalRun[]
  evalOpen: boolean
  addTestCase: (testCase: Omit<EvalTestCase, 'id'>) => void
  removeTestCase: (id: string) => void
  updateTestCase: (id: string, patch: Partial<Omit<EvalTestCase, 'id'>>) => void
  addRun: (run: EvalRun) => void
  setEvalOpen: (open: boolean) => void
}

export const useEvalStore = create<EvalState>((set, get) => ({
  testCases: [],
  runs: [],
  evalOpen: false,

  addTestCase: (testCase) =>
    set({
      testCases: [
        ...get().testCases,
        { ...testCase, id: crypto.randomUUID() },
      ],
    }),

  removeTestCase: (id) =>
    set({ testCases: get().testCases.filter((t) => t.id !== id) }),

  updateTestCase: (id, patch) =>
    set({
      testCases: get().testCases.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    }),

  addRun: (run) => set({ runs: [...get().runs, run] }),

  setEvalOpen: (evalOpen) => set({ evalOpen }),
}))
