// T2-2: ephemeral playback/UI state for the Time-Travel Debugger.
// Snapshots themselves live on the selected RunRecord (runHistoryStore); this
// store only holds which step is focused and the playback controls. Kept as its
// own domain store per the store rules (eval/prompt/run-history precedent).
import { create } from 'zustand'

export type PlaybackSpeed = 0.5 | 1 | 2 | 4
export type DockTab = 'trace' | 'timeTravel'

interface DebuggerState {
  /** Which tab the bottom dock shows. */
  dockTab: DockTab
  /** Index into the selected run's `snapshots`. */
  activeStepIndex: number
  isPlaying: boolean
  playbackSpeed: PlaybackSpeed
  /** Node id of the active step — drives the canvas highlight (NodeShell reads this). */
  activeStepNodeId: string | null
  /** Whether SnapshotInspector highlights changes vs the previous step. */
  showDiff: boolean

  setDockTab: (tab: DockTab) => void
  /** Focus a step and the node it executed (pass null when there is no step). */
  setActiveStep: (index: number, nodeId: string | null) => void
  play: () => void
  pause: () => void
  setSpeed: (speed: PlaybackSpeed) => void
  toggleDiff: () => void
  /** Return to step 0, stop playback, clear the canvas highlight. */
  reset: () => void
}

export const useDebuggerStore = create<DebuggerState>((set) => ({
  dockTab: 'trace',
  activeStepIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  activeStepNodeId: null,
  showDiff: false,

  setDockTab: (dockTab) => set({ dockTab }),
  setActiveStep: (activeStepIndex, activeStepNodeId) =>
    set({ activeStepIndex, activeStepNodeId }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  setSpeed: (playbackSpeed) => set({ playbackSpeed }),
  toggleDiff: () => set((s) => ({ showDiff: !s.showDiff })),
  reset: () =>
    set({ activeStepIndex: 0, isPlaying: false, activeStepNodeId: null }),
}))
