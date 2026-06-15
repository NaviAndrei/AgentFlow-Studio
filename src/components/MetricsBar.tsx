import {
  Check,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Terminal,
  X,
} from 'lucide-react'
import { useEvalStore } from '../store/evalStore'
import { useSimulationMetricsStore } from '../store/simulationMetricsStore'
import { useSimulationStore } from '../store/simulationStore'
import { HintIcon } from './HintIcon'
import { HINTS } from '../data/hints'

const btnCls =
  'flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 transition-colors hover:border-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'

function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0')
  return `${String(minutes).padStart(2, '0')}:${seconds}`
}

export function MetricsBar() {
  const isActive = useSimulationStore((s) => s.isActive)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const queueLength = useSimulationStore((s) => s.executionQueue.length)
  const currentNodeIndex = useSimulationStore((s) => s.currentNodeIndex)
  const play = useSimulationStore((s) => s.play)
  const pause = useSimulationStore((s) => s.pause)
  const step = useSimulationStore((s) => s.step)
  const restart = useSimulationStore((s) => s.restart)
  const stop = useSimulationStore((s) => s.stop)
  const traceOpen = useSimulationStore((s) => s.traceOpen)
  const setTraceOpen = useSimulationStore((s) => s.setTraceOpen)
  const liveMode = useSimulationStore((s) => s.liveMode)
  const userInput = useSimulationStore((s) => s.userInput)
  const setUserInput = useSimulationStore((s) => s.setUserInput)
  const pendingApproval = useSimulationStore((s) => s.pendingApproval)
  const approve = useSimulationStore((s) => s.approve)
  const reject = useSimulationStore((s) => s.reject)

  const stepIndex = useSimulationMetricsStore((s) => s.stepIndex)
  const stepTotal = useSimulationMetricsStore((s) => s.stepTotal)
  const activeNodeCount = useSimulationMetricsStore((s) => s.activeNodeCount)
  const elapsedMs = useSimulationMetricsStore((s) => s.elapsedMs)
  const tokens = useSimulationMetricsStore((s) => s.tokens)
  const costSummary = useSimulationMetricsStore((s) => s.costSummary)
  const runs = useEvalStore((s) => s.runs)
  const lastRun = runs.length > 0 ? runs[runs.length - 1] : null
  const passing =
    lastRun?.results.filter((r) => r.score === 1).length ?? 0
  const totalCases = lastRun?.results.length ?? 0
  const evalColor =
    lastRun && totalCases > 0
      ? passing === totalCases
        ? 'text-accent'
        : passing > 0
          ? 'text-yellow-400'
          : 'text-red-400'
      : 'text-gray-400'

  const formatCost = (v: number) =>
    v < 0.001 ? `$${v.toFixed(5)}` : `$${v.toPrecision(4)}`

  const finished = currentNodeIndex >= queueLength
  const shownStep = stepTotal === 0 ? 0 : Math.min(stepIndex + 1, stepTotal)
  const progressPct =
    stepTotal === 0 ? 0 : Math.min((currentNodeIndex / stepTotal) * 100, 100)

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 flex h-12 items-center gap-6 border-t border-white/10 bg-surface-2 px-4 transition-transform duration-300 ${
        isActive ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap text-xs text-gray-300">
          Step {shownStep}/{stepTotal}
        </span>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <HintIcon text={HINTS.controls.stepCounter} />
      </div>

      <div className="flex flex-1 items-center justify-center gap-5 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="text-accent">{activeNodeCount}</span> active
          <HintIcon text={HINTS.controls.activeCount} />
        </span>
        <span className="tabular-nums">{formatElapsed(elapsedMs)}</span>
        <span className="flex items-center gap-1">
          ~<span className="text-accent">{tokens}</span> tokens
          <HintIcon text={HINTS.controls.tokens} />
        </span>
        {costSummary && (
          <span className="flex items-center gap-1 tabular-nums">
            <span className="text-accent">
              {formatCost(costSummary.totalCostUsd)}
            </span>
          </span>
        )}
        {lastRun && totalCases > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <span className={evalColor}>
              ✓ {passing}/{totalCases}
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {pendingApproval && (
          <div className="mr-1 flex items-center gap-1.5">
            <span className="whitespace-nowrap text-[11px] font-medium text-amber-400">
              Awaiting approval
            </span>
            <button
              onClick={approve}
              className={`${btnCls} border-green-500/50 text-green-400 hover:border-green-500 hover:text-green-300`}
            >
              <Check size={11} />
              Approve
            </button>
            <HintIcon text={HINTS.controls.approve} />
            <button
              onClick={reject}
              className={`${btnCls} border-red-500/50 text-red-400 hover:border-red-500 hover:text-red-300`}
            >
              <X size={11} />
              Reject
            </button>
            <HintIcon text={HINTS.controls.reject} />
          </div>
        )}
        {liveMode && (
          <input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="User message for Start node…"
            className="w-52 rounded-md border border-amber-500/40 bg-surface px-2 py-1 text-[11px] text-gray-200 placeholder:text-gray-600 focus:border-amber-500 focus:outline-none"
          />
        )}
        {isRunning ? (
          <button onClick={pause} className={btnCls}>
            <Pause size={11} />
            Pause
          </button>
        ) : (
          <button
            onClick={play}
            disabled={finished || !!pendingApproval}
            className={btnCls}
          >
            <Play size={11} />
            Play
          </button>
        )}
        <button
          onClick={step}
          disabled={finished || isRunning || !!pendingApproval}
          className={btnCls}
        >
          <SkipForward size={11} />
          Step
        </button>
        <HintIcon text={HINTS.controls.step} />
        <button onClick={restart} className={btnCls}>
          <RotateCcw size={11} />
          Restart
        </button>
        <button onClick={stop} className={btnCls}>
          <Square size={11} />
          Stop
        </button>
        <button
          onClick={() => setTraceOpen(!traceOpen)}
          className={`${btnCls} ${traceOpen ? 'border-accent/60 text-accent' : ''}`}
          title="Toggle execution trace"
        >
          <Terminal size={11} />
          Trace
        </button>
        <HintIcon text={HINTS.controls.trace} />
      </div>
    </div>
  )
}
