import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EvalDataset, EvalDatasetRun, EvalRow, EvalRun, EvalTestCase, LastRunSummary } from '../types'
import { scoreExactMatch } from '../utils/evalScoring'

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
  /** Dismisses the last run summary bar. */
  clearRunSummary: () => void
  setEvalOpen: (open: boolean) => void

  /** Dataset Runner: imported CSV/JSON datasets and their execution history. */
  datasets: EvalDataset[]
  datasetRuns: EvalDatasetRun[]
  currentRunId: string | null
  addDataset: (dataset: EvalDataset) => void
  removeDataset: (id: string) => void
  /** Drives each row's input through the live flow one at a time, scoring with exact match. */
  runDataset: (datasetId: string) => Promise<void>
}

export const useEvalStore = create<EvalState>()(
  persist(
    (set, get) => ({
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

      clearRunSummary: () => set({ lastRunSummary: null }),

      setEvalOpen: (evalOpen) => set({ evalOpen }),

      datasets: [],
      datasetRuns: [],
      currentRunId: null,

      addDataset: (dataset) => set({ datasets: [...get().datasets, dataset] }),

      removeDataset: (id) =>
        set({ datasets: get().datasets.filter((d) => d.id !== id) }),

      runDataset: async (datasetId) => {
        const dataset = get().datasets.find((d) => d.id === datasetId)
        if (!dataset) return
        const { useSimulationStore } = await import('./simulationStore')

        const runId = crypto.randomUUID()
        set({ currentRunId: runId })
        const results: EvalRow[] = []

        for (const row of dataset.rows) {
          const sim = useSimulationStore.getState()
          const beforeTimestamp = get().lastRunSummary?.timestamp ?? 0
          sim.setUserInput(row.input)
          sim.start()

          // Yield until the run's finishRun() records a fresh summary, or
          // bail out after a generous bound so a stuck flow can't hang the
          // dataset pass forever.
          for (let i = 0; i < 2000; i++) {
            await new Promise((r) => setTimeout(r, 0))
            const summary = useEvalStore.getState().lastRunSummary
            if (summary && summary.timestamp > beforeTimestamp) break
          }

          const trace = useSimulationStore.getState().trace
          const messages = useSimulationStore.getState().messages
          const outputEntry = [...trace]
            .reverse()
            .find((e) => e.nodeType === 'output' && (e.status === 'ok' || e.status === 'cached'))
          const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
          const actualOutput = outputEntry?.output ?? lastAssistant?.content ?? ''

          results.push({
            ...row,
            actualOutput,
            score: scoreExactMatch(row.expectedOutput, actualOutput),
            scoreMethod: 'exact',
          })
        }

        const averageScore =
          results.length > 0
            ? results.reduce((sum, r) => sum + (r.score ?? 0), 0) / results.length
            : 0

        set({
          datasetRuns: [
            ...get().datasetRuns,
            { id: runId, datasetId, startedAt: Date.now(), completedAt: Date.now(), results, averageScore },
          ],
          currentRunId: null,
        })
      },
    }),
    {
      name: 'eval-datasets',
      partialize: (state) => ({ datasets: state.datasets }),
    },
  ),
)
