import { create } from 'zustand'

interface SimulationMetricsState {
  stepIndex: number
  stepTotal: number
  activeNodeCount: number
  elapsedMs: number
  tokens: number
  setStep: (index: number, total: number) => void
  setActiveNodeCount: (count: number) => void
  addTokens: (count: number) => void
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

    setStep: (stepIndex, stepTotal) => set({ stepIndex, stepTotal }),
    setActiveNodeCount: (activeNodeCount) => set({ activeNodeCount }),
    addTokens: (count) => set({ tokens: get().tokens + count }),

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
      })
    },
  }),
)
