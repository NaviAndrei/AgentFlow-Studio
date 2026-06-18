import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, History, Search, Trash2 } from 'lucide-react'
import { useRunHistoryStore } from '../store/runHistoryStore'
import { useDebuggerStore } from '../store/debuggerStore'
import { useSimulationStore } from '../store/simulationStore'
import { CostBreakdown } from './CostPanel'
import { TraceEntryRow } from './TraceLog'
import { diffRuns, type NodeDiff } from '../utils/diffRuns'
import type { RunRecord } from '../types'

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.0000'
  if (usd < 0.001) return `$${usd.toFixed(5)}`
  return `$${usd.toPrecision(4)}`
}

const STATUS_DOT: Record<RunRecord['status'], string> = {
  done: 'bg-green-500',
  error: 'bg-red-500',
  stopped: 'bg-yellow-500',
}

function evalColor(pass: number, total: number): string {
  if (total === 0) return 'text-gray-400'
  if (pass === total) return 'text-accent'
  if (pass > 0) return 'text-yellow-400'
  return 'text-red-400'
}

function matchesSearch(run: RunRecord, query: string): boolean {
  if (query.trim() === '') return true
  const q = query.toLowerCase()
  if (run.model.toLowerCase().includes(q)) return true
  return run.traceSnapshot.some((e) => e.output?.toLowerCase().includes(q))
}

function DiffTable({ diff }: { diff: NodeDiff[] }) {
  return (
    <div className="max-h-48 overflow-y-auto rounded border border-white/10">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-surface-2 text-gray-400">
          <tr>
            <th className="px-2 py-1 text-left">Node</th>
            <th className="px-2 py-1 text-left">Status A→B</th>
            <th className="px-2 py-1 text-left">Output A</th>
            <th className="px-2 py-1 text-left">Output B</th>
            <th className="px-2 py-1 text-right">Δ Duration</th>
          </tr>
        </thead>
        <tbody>
          {diff.map((d) => {
            const improved = d.statusA === 'error' && d.statusB === 'ok'
            const degraded = d.statusA === 'ok' && d.statusB === 'error'
            return (
              <tr
                key={d.nodeId}
                className={
                  improved
                    ? 'bg-green-500/10 text-green-300'
                    : degraded
                      ? 'bg-red-500/10 text-red-300'
                      : 'text-gray-400'
                }
              >
                <td className="truncate px-2 py-1">{d.nodeLabel}</td>
                <td className="px-2 py-1">
                  {d.statusA ?? '—'} → {d.statusB ?? '—'}
                </td>
                <td className="max-w-[160px] truncate px-2 py-1">
                  {(d.outputA ?? '—').slice(0, 120)}
                </td>
                <td className="max-w-[160px] truncate px-2 py-1">
                  {(d.outputB ?? '—').slice(0, 120)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {d.durationDeltaMs > 0 ? '+' : ''}
                  {d.durationDeltaMs}ms
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RunHistoryPanel() {
  const open = useRunHistoryStore((s) => s.panelOpen)
  const setOpen = useRunHistoryStore((s) => s.setPanelOpen)
  const runs = useRunHistoryStore((s) => s.runs)
  const clearAll = useRunHistoryStore((s) => s.clearAll)
  const deleteRun = useRunHistoryStore((s) => s.deleteRun)
  const searchQuery = useRunHistoryStore((s) => s.searchQuery)
  const setSearchQuery = useRunHistoryStore((s) => s.setSearchQuery)
  const filterStatus = useRunHistoryStore((s) => s.filterStatus)
  const setFilterStatus = useRunHistoryStore((s) => s.setFilterStatus)
  const filterMode = useRunHistoryStore((s) => s.filterMode)
  const setFilterMode = useRunHistoryStore((s) => s.setFilterMode)
  const selectedRunId = useRunHistoryStore((s) => s.selectedRunId)
  const setSelectedRunId = useRunHistoryStore((s) => s.setSelectedRunId)
  const compareRunIds = useRunHistoryStore((s) => s.compareRunIds)
  const setCompareRunIds = useRunHistoryStore((s) => s.setCompareRunIds)

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null

  const setDockTab = useDebuggerStore((s) => s.setDockTab)
  const resetDebugger = useDebuggerStore((s) => s.reset)
  const setActiveStep = useDebuggerStore((s) => s.setActiveStep)
  const setTraceOpen = useSimulationStore((s) => s.setTraceOpen)

  // Select a run for inspection and open the bottom dock's Time Travel tab on it.
  const selectRun = (run: RunRecord) => {
    setSelectedRunId(run.id)
    resetDebugger()
    setActiveStep(0, run.snapshots[0]?.nodeId ?? null)
    setDockTab('timeTravel')
    setTraceOpen(true)
  }

  const toggleCompare = (id: string) => {
    if (!compareRunIds) {
      setCompareRunIds([id, id])
      return
    }
    const [first, second] = compareRunIds
    if (id === first || id === second) {
      setCompareRunIds(null)
      return
    }
    setCompareRunIds([first, id])
  }

  const diff = useMemo(() => {
    if (!compareRunIds) return null
    const [idA, idB] = compareRunIds
    if (idA === idB) return null
    const runA = runs.find((r) => r.id === idA)
    const runB = runs.find((r) => r.id === idB)
    if (!runA || !runB) return null
    return diffRuns(runA, runB)
  }, [compareRunIds, runs])

  const filtered = runs.filter(
    (r) =>
      (filterStatus === 'all' || r.status === filterStatus) &&
      (filterMode === 'all' || r.mode === filterMode) &&
      matchesSearch(r, searchQuery),
  )

  return (
    <div
      className={`fixed right-0 top-12 bottom-0 z-20 flex w-96 flex-col border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <History size={13} className="text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
          Run History
        </span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
          {runs.length}
        </span>
        {runs.length > 0 && (
          <button
            onClick={clearAll}
            title="Clear all runs"
            className="text-gray-500 hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          aria-label="Close run history"
          className="ml-auto rounded-md p-0.5 text-gray-500 hover:text-gray-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {selectedRun ? (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <button
            onClick={() => setSelectedRunId(null)}
            className="mb-3 flex items-center gap-1 text-[10px] text-gray-400 hover:text-accent"
          >
            <ChevronLeft size={12} />
            Back to list
          </button>

          <div className="mb-3 rounded-md border border-white/10 bg-canvas p-2 text-[11px] text-gray-300">
            <div className="mb-1 flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[selectedRun.status]}`} />
              <span className="capitalize">{selectedRun.status}</span>
              <span className="text-gray-500">·</span>
              <span>{selectedRun.mode === 'live' ? 'Live' : 'Simulated'}</span>
              <span className="ml-auto text-gray-500">
                {formatRelativeTime(selectedRun.startedAt)}
              </span>
            </div>
            <div className="text-gray-500">
              {selectedRun.model || 'unknown model'} · {selectedRun.stepCount} steps ·{' '}
              {(selectedRun.durationMs / 1000).toFixed(1)}s
            </div>
            {selectedRun.qualityScore !== null && (
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={evalColor(
                    selectedRun.evalPassCount ?? 0,
                    selectedRun.evalTotalCount ?? 0,
                  )}
                >
                  ✓ {selectedRun.evalPassCount}/{selectedRun.evalTotalCount}
                </span>
                <span className="text-gray-500">{selectedRun.qualityScore}pts</span>
              </div>
            )}
          </div>

          {selectedRun.costSnapshot && (
            <div className="mb-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Cost &amp; Tokens
              </div>
              <CostBreakdown summary={selectedRun.costSnapshot} />
            </div>
          )}

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Trace
            </div>
            {selectedRun.traceSnapshot.map((entry) => (
              <TraceEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 space-y-1.5 border-b border-white/10 px-3 py-2">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search outputs…"
                className="w-full rounded border border-white/10 bg-canvas py-1 pl-6 pr-2 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'done', 'error', 'stopped'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-md px-2 py-0.5 text-[10px] capitalize transition-colors ${
                    filterStatus === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(
                [
                  ['all', 'All'],
                  ['simulated', 'Sim'],
                  ['live', 'Live'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilterMode(value)}
                  className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
                    filterMode === value ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded border border-dashed border-white/10 px-2 py-6 text-center text-[10px] text-gray-600">
                <History size={20} className="text-gray-700" />
                {runs.length === 0
                  ? 'No runs yet. Start a simulation to record your first run.'
                  : 'No runs match these filters.'}
              </div>
            )}
            {filtered.map((run) => (
              <div
                key={run.id}
                onClick={() => selectRun(run)}
                className={`mb-2 cursor-pointer rounded-lg bg-surface-2 p-3 hover:bg-white/5 ${
                  selectedRunId === run.id ? 'border border-accent/40' : ''
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] text-gray-500">
                  <input
                    type="checkbox"
                    className="nodrag"
                    title="Select to compare"
                    checked={
                      !!compareRunIds &&
                      (compareRunIds[0] === run.id || compareRunIds[1] === run.id)
                    }
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleCompare(run.id)
                    }}
                  />
                  <span>{formatRelativeTime(run.startedAt)}</span>
                  <span
                    className={`rounded px-1 py-0.5 ${
                      run.mode === 'live' ? 'bg-accent/15 text-accent' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {run.mode === 'live' ? 'Live' : 'Sim'}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[run.status]}`} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteRun(run.id)
                    }}
                    aria-label="Delete run"
                    className="ml-auto text-gray-600 hover:text-red-400"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-gray-200">
                    {run.model || 'unknown model'}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
                    ~{run.totalTokens} tokens · {formatCost(run.totalCostUsd)} ·{' '}
                    {(run.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
                {run.qualityScore !== null && (
                  <div className="mt-1 flex items-center gap-2 text-[10px]">
                    <span
                      className={evalColor(run.evalPassCount ?? 0, run.evalTotalCount ?? 0)}
                    >
                      ✓ {run.evalPassCount}/{run.evalTotalCount}
                    </span>
                    <span className="text-gray-500">{run.qualityScore}pts</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {diff && (
            <div className="shrink-0 border-t border-white/10 p-2">
              <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                <span>Comparing 2 runs</span>
                <button
                  onClick={() => setCompareRunIds(null)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
              <DiffTable diff={diff} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
