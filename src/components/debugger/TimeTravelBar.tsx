// T2-2: scrubber toolbar for the Time-Travel Debugger — replays a completed
// run step-by-step, driving the canvas highlight and SnapshotInspector.
import { useCallback, useEffect, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { useDebuggerStore, type PlaybackSpeed } from '../../store/debuggerStore'
import { useRunHistoryStore } from '../../store/runHistoryStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useToastStore } from '../../store/toastStore'

/** Base dwell per step at 1× (ms); divided by the playback speed. */
const BASE_STEP_MS = 900
const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4]

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function TimeTravelBar() {
  const selectedRunId = useRunHistoryStore((s) => s.selectedRunId)
  const run = useRunHistoryStore((s) =>
    selectedRunId ? (s.runs.find((r) => r.id === selectedRunId) ?? null) : null,
  )
  const activeStepIndex = useDebuggerStore((s) => s.activeStepIndex)
  const isPlaying = useDebuggerStore((s) => s.isPlaying)
  const playbackSpeed = useDebuggerStore((s) => s.playbackSpeed)
  const setActiveStep = useDebuggerStore((s) => s.setActiveStep)
  const play = useDebuggerStore((s) => s.play)
  const pause = useDebuggerStore((s) => s.pause)
  const setSpeed = useDebuggerStore((s) => s.setSpeed)

  const selectOnly = useCanvasStore((s) => s.selectOnly)
  const forkFromSnapshot = useSimulationStore((s) => s.forkFromSnapshot)
  const setDockTab = useDebuggerStore((s) => s.setDockTab)
  const pushToast = useToastStore((s) => s.pushToast)
  const { setCenter } = useReactFlow()

  const snapshots = useMemo(() => run?.snapshots ?? [], [run])
  const total = snapshots.length
  const reduced = prefersReducedMotion()

  // Read the live index from the store (not the rendered closure) so rapid
  // clicks / key-repeats advance step-by-step instead of collapsing to one.
  const currentIndex = () => useDebuggerStore.getState().activeStepIndex

  // Move to a step: clamp, focus the node on the canvas, update the store.
  const goto = useCallback(
    (index: number) => {
      if (total === 0) return
      const clamped = Math.max(0, Math.min(total - 1, index))
      const snap = snapshots[clamped]
      setActiveStep(clamped, snap?.nodeId ?? null)
      if (snap) {
        const node = useCanvasStore.getState().nodes.find((n) => n.id === snap.nodeId)
        if (node) {
          selectOnly(snap.nodeId)
          void setCenter(node.position.x + 104, node.position.y + 40, {
            zoom: 1.2,
            duration: reduced ? 0 : 400,
          })
        }
      }
    },
    [snapshots, total, setActiveStep, selectOnly, setCenter, reduced],
  )

  // Auto-advance while playing; stop at the last step.
  useEffect(() => {
    if (!isPlaying || total === 0) return
    if (activeStepIndex >= total - 1) {
      pause()
      return
    }
    const id = window.setTimeout(
      () => goto(activeStepIndex + 1),
      BASE_STEP_MS / playbackSpeed,
    )
    return () => window.clearTimeout(id)
  }, [isPlaying, activeStepIndex, playbackSpeed, total, goto, pause])

  // Keyboard: ← / → step, Space play/pause (ignore while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        pause()
        goto(currentIndex() - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        pause()
        goto(currentIndex() + 1)
      } else if (e.key === ' ') {
        e.preventDefault()
        if (isPlaying) pause()
        else if (!reduced) play()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeStepIndex, isPlaying, reduced, goto, play, pause])

  if (total === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-3 py-4 text-[11px] text-gray-600">
        Run a simulation first to enable time travel.
      </div>
    )
  }

  const atFirst = activeStepIndex <= 0
  const atLast = activeStepIndex >= total - 1

  const handleFork = () => {
    const snap = snapshots[activeStepIndex]
    if (!snap) return
    forkFromSnapshot(snapshots, activeStepIndex)
    setDockTab('trace')
    pushToast(`Forking run from step ${activeStepIndex + 1} — ${snap.nodeName}`)
  }

  const btn =
    'flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-surface-2 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
      <div className="flex items-center gap-0.5">
        <button onClick={() => { pause(); goto(0) }} disabled={atFirst} className={btn} title="First step" aria-label="First step">
          <SkipBack size={14} />
        </button>
        <button onClick={() => { pause(); goto(currentIndex() - 1) }} disabled={atFirst} className={btn} title="Previous step" aria-label="Previous step">
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => (isPlaying ? pause() : play())}
          disabled={reduced || atLast}
          className={btn}
          title={reduced ? 'Auto-play disabled (reduced motion)' : isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={() => { pause(); goto(currentIndex() + 1) }} disabled={atLast} className={btn} title="Next step" aria-label="Next step">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => { pause(); goto(total - 1) }} disabled={atLast} className={btn} title="Last step" aria-label="Last step">
          <SkipForward size={14} />
        </button>
      </div>

      <span className="tabular-nums text-[11px] text-gray-400">
        Step {activeStepIndex + 1} / {total}
      </span>

      <input
        type="range"
        min={0}
        max={total - 1}
        value={activeStepIndex}
        onChange={(e) => { pause(); goto(Number(e.target.value)) }}
        aria-label="Scrub run steps"
        className="mx-2 h-1 flex-1 cursor-pointer accent-accent"
      />

      <div className="flex items-center gap-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`rounded px-1.5 py-0.5 text-[10px] tabular-nums transition-colors ${
              playbackSpeed === s ? 'bg-accent/15 text-accent' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <button
        onClick={handleFork}
        disabled={atLast}
        title={
          atLast
            ? 'Nothing to fork onward from the last step'
            : 'Fork from here — start a new run resuming at this step'
        }
        className="ml-1 flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 transition-colors hover:bg-surface-2 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <GitBranch size={11} />
        Fork
      </button>
    </div>
  )
}
