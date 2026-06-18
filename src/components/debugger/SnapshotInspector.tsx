// T2-2: side panel for the Time-Travel Debugger — shows the input/output state
// of the focused step, with an optional diff highlight vs the previous step.
import { GitCompare } from 'lucide-react'
import { JsonValue } from '../StateInspector'
import { useDebuggerStore } from '../../store/debuggerStore'
import { useRunHistoryStore } from '../../store/runHistoryStore'
import type { StepSnapshot } from '../../types'

/** Keys whose value differs (by JSON identity) between two output states. */
function changedKeys(curr: unknown, prev: unknown): Set<string> {
  const out = new Set<string>()
  if (
    typeof curr !== 'object' ||
    curr === null ||
    Array.isArray(curr) ||
    typeof prev !== 'object' ||
    prev === null ||
    Array.isArray(prev)
  ) {
    return out
  }
  const c = curr as Record<string, unknown>
  const p = prev as Record<string, unknown>
  for (const key of Object.keys(c)) {
    if (JSON.stringify(c[key]) !== JSON.stringify(p[key])) out.add(key)
  }
  return out
}

function OutputView({ snap, prev, showDiff }: {
  snap: StepSnapshot
  prev: StepSnapshot | null
  showDiff: boolean
}) {
  const output = snap.outputState
  const isObject =
    typeof output === 'object' && output !== null && !Array.isArray(output)

  if (!showDiff || !prev || !isObject) {
    return <JsonValue value={output} />
  }

  const changed = changedKeys(output, prev.outputState)
  const entries = Object.entries(output as Record<string, unknown>)
  return (
    <span>
      <span className="text-gray-500">{'{'}</span>
      <div className="border-l border-white/5 pl-3">
        {entries.map(([key, v]) => {
          const isChanged = changed.has(key)
          return (
            <div
              key={key}
              className={isChanged ? 'rounded bg-amber-400/10 px-1 -mx-1' : ''}
            >
              <span className={isChanged ? 'text-amber-300' : 'text-accent'}>
                {key}
              </span>
              <span className="text-gray-600">: </span>
              <JsonValue value={v} />
            </div>
          )
        })}
      </div>
      <span className="text-gray-500">{'}'}</span>
    </span>
  )
}

export function SnapshotInspector() {
  const selectedRunId = useRunHistoryStore((s) => s.selectedRunId)
  const run = useRunHistoryStore((s) =>
    selectedRunId ? (s.runs.find((r) => r.id === selectedRunId) ?? null) : null,
  )
  const activeStepIndex = useDebuggerStore((s) => s.activeStepIndex)
  const showDiff = useDebuggerStore((s) => s.showDiff)
  const toggleDiff = useDebuggerStore((s) => s.toggleDiff)

  const snapshots = run?.snapshots ?? []
  const snap = snapshots[activeStepIndex] ?? null
  const prev = activeStepIndex > 0 ? (snapshots[activeStepIndex - 1] ?? null) : null

  if (!snap) {
    return (
      <p className="px-3 py-3 text-[11px] text-gray-600">
        No state captured for this step.
      </p>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 text-[11px] leading-relaxed">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              snap.status === 'error'
                ? 'bg-red-500'
                : snap.status === 'cached'
                  ? 'bg-gray-400'
                  : 'bg-green-500'
            }`}
          />
          {snap.nodeName}
        </span>
        <span className="text-[10px] text-gray-500">{snap.nodeType}</span>
        <span className="text-[10px] tabular-nums text-gray-600">
          {snap.durationMs}ms
        </span>
        <button
          onClick={toggleDiff}
          className={`ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] transition-colors ${
            showDiff
              ? 'bg-accent/15 text-accent'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <GitCompare size={11} />
          Diff
        </button>
      </div>

      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Input state
      </h4>
      <div className="mb-3 rounded-md border border-white/10 bg-canvas p-2">
        <JsonValue value={snap.inputState} />
      </div>

      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Output state
        {showDiff && prev && (
          <span className="ml-1 normal-case tracking-normal text-amber-400/80">
            (vs step {prev.stepIndex + 1})
          </span>
        )}
      </h4>
      <div className="rounded-md border border-white/10 bg-canvas p-2">
        <OutputView snap={snap} prev={prev} showDiff={showDiff} />
      </div>
    </div>
  )
}
