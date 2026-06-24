import { create } from 'zustand'
import type { EvalRun, EvalTestCase, LastRunSummary } from '../types'

interface EvalState {
  testCases: EvalTestCase[]
  runs: EvalRun[]
  evalOpen: boolean
  /** Summary of the most recently completed execution run; null before any run. */
  lastRunSummary: LastRunSummary | null
  addTestCase: (testCase: Omit<EvalTestCase, 'id'>) => void
  addMany: (cases: Array<Pick<EvalTestCase, 'input' | 'expectedOutput' | 'description'>>) => void
  removeTestCase: (id: string) => void
  updateTestCase: (id: string, patch: Partial<Omit<EvalTestCase, 'id'>>) => void
  addRun: (run: EvalRun) => void
  /** Records the summary of a just-finished run (called from simulationStore). */
  recordRunSummary: (summary: LastRunSummary) => void
  setEvalOpen: (open: boolean) => void
}

export const useEvalStore = create<EvalState>((set, get) => ({
  testCases: [],
  runs: [],
  evalOpen: false,
  lastRunSummary: null,

  addTestCase: (testCase) =>
    set({
      testCases: [
        ...get().testCases,
        { ...testCase, id: crypto.randomUUID() },
      ],
    }),

  addMany: (cases) =>
    set({
      testCases: [
        ...get().testCases,
        ...cases.map((c) => ({
          id: crypto.randomUUID(),
          input: c.input,
          expectedOutput: c.expectedOutput,
          description: c.description,
        })),
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

  recordRunSummary: (lastRunSummary) => set({ lastRunSummary }),

  setEvalOpen: (evalOpen) => set({ evalOpen }),
}))
