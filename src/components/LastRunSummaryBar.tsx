import { X } from 'lucide-react'
import { useEvalStore } from '../store/evalStore'

/**
 * Read-only one-line summary of the most recently completed run, shown
 * directly beneath the Navbar run toolbar. Renders nothing until a run has
 * finished. Format: "Last run: X nodes, Y errors, Zms".
 */
export function LastRunSummaryBar() {
  const summary = useEvalStore((s) => s.lastRunSummary)
  const clearRunSummary = useEvalStore((s) => s.clearRunSummary)
  if (!summary) return null

  const hasErrors = summary.errorCount > 0
  const nodeLabel = summary.nodesExecuted === 1 ? 'node' : 'nodes'
  const errorLabel = summary.errorCount === 1 ? 'error' : 'errors'

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-7 shrink-0 items-center justify-between gap-1.5 border-b border-white/10 bg-surface-2 px-4 text-[11px] text-gray-400"
    >
      <div className="flex items-center gap-1.5">
        <span className={hasErrors ? 'text-amber-400' : 'text-emerald-400'}>
          {hasErrors ? '⚠' : '✓'}
        </span>
        <span className="text-gray-500">Last run:</span>
        <span className="tabular-nums text-gray-300">
          {summary.nodesExecuted} {nodeLabel}
        </span>
        {hasErrors && (
          <>
            <span className="text-gray-600">·</span>
            <span className="tabular-nums text-amber-400">
              {summary.errorCount} {errorLabel}
            </span>
          </>
        )}
        <span className="text-gray-600">·</span>
        <span className="tabular-nums text-gray-300">
          {Math.round(summary.totalLatencyMs)}ms
        </span>
      </div>
      <button
        onClick={clearRunSummary}
        aria-label="Dismiss last run summary"
        className="rounded p-0.5 text-gray-500 transition-colors hover:text-gray-300"
      >
        <X size={12} />
      </button>
    </div>
  )
}
