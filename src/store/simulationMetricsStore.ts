import { create } from 'zustand'
import type { RunCostSummary } from '../types'

interface SimulationMetricsState {
  stepIndex: number
  stepTotal: number
  activeNodeCount: number
  elapsedMs: number
  tokens: number
  costSummary: RunCostSummary | null
  setStep: (index: number, total: number) => void
  setActiveNodeCount: (count: number) => void
  addTokens: (count: number) => void
  setCostSummary: (summary: RunCostSummary | null) => void
  startTimer: () => void
  pauseTimer: () => void
  resetAll: () => void
}

let interval: number | null = null
let accumulatedMs = 0
let resumedAt = 0

export const useSimulationMetricsStore = create<SimulationMetricsState>(
  (set, get) => ({
    stepIndex: 0,
    stepTotal: 0,
    activeNodeCount: 0,
    elapsedMs: 0,
    tokens: 0,
    costSummary: null,

    // stepTotal never shrinks within a run: the queue grows as targets are
    // discovered and joins re-queue while waiting, so a monotonic denominator
    // keeps the progress readout from jumping backwards.
    setStep: (stepIndex, stepTotal) =>
      set({ stepIndex, stepTotal: Math.max(get().stepTotal, stepTotal) }),
    setActiveNodeCount: (activeNodeCount) => set({ activeNodeCount }),
    addTokens: (count) => set({ tokens: get().tokens + count }),

    setCostSummary: (costSummary) => set({ costSummary }),

    startTimer: () => {
      if (interval !== null) return
      resumedAt = Date.now()
      interval = window.setInterval(() => {
        set({ elapsedMs: accumulatedMs + (Date.now() - resumedAt) })
      }, 200)
    },

    pauseTimer: () => {
      if (interval === null) return
      window.clearInterval(interval)
      interval = null
      accumulatedMs += Date.now() - resumedAt
      set({ elapsedMs: accumulatedMs })
    },

    resetAll: () => {
      if (interval !== null) {
        window.clearInterval(interval)
        interval = null
      }
      accumulatedMs = 0
      set({
        stepIndex: 0,
        stepTotal: 0,
        activeNodeCount: 0,
        elapsedMs: 0,
        tokens: 0,
        costSummary: null,
      })
    },
  }),
)
