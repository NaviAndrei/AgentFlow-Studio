import { useEvalStore } from '../store/evalStore'

/**
 * Read-only one-line summary of the most recently completed run, shown
 * directly beneath the Navbar run toolbar. Renders nothing until a run has
 * finished. Format: "Last run: X nodes, Y errors, Zms".
 */
export function LastRunSummaryBar() {
  const summary = useEvalStore((s) => s.lastRunSummary)
  if (!summary) return null

  const nodeLabel = summary.nodesExecuted === 1 ? 'node' : 'nodes'
  const errorLabel = summary.errorCount === 1 ? 'error' : 'errors'

  return (
    <div
      role="status"
      className="flex h-7 shrink-0 items-center gap-1.5 border-b border-white/10 bg-surface-2 px-4 text-[11px] text-gray-400"
    >
      <span className="text-gray-500">Last run:</span>
      <span className="tabular-nums text-gray-300">
        {summary.nodesExecuted} {nodeLabel}
      </span>
      <span className="text-gray-600">·</span>
      <span
        className={`tabular-nums ${summary.errorCount > 0 ? 'text-red-400' : 'text-gray-300'}`}
      >
        {summary.errorCount} {errorLabel}
      </span>
      <span className="text-gray-600">·</span>
      <span className="tabular-nums text-gray-300">
        {Math.round(summary.totalLatencyMs)}ms
      </span>
    </div>
  )
}
