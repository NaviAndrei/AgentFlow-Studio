import type { RunSpan } from '../types'

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.0000'
  if (usd < 0.001) return `$${usd.toFixed(5)}`
  return `$${usd.toPrecision(4)}`
}

/** Proportional-width bar chart of a run's per-node spans. Pure, no library. */
export function SpanTimeline({ spans }: { spans: RunSpan[] }) {
  if (spans.length === 0) {
    return <div className="px-2 py-3 text-center text-[10px] text-gray-600">No spans recorded for this run.</div>
  }

  const maxDuration = Math.max(...spans.map((s) => s.durationMs), 1)

  return (
    <div className="space-y-1">
      {spans.map((span) => (
        <div key={span.spanId} className="flex items-center gap-2 text-[10px]">
          <span className="w-20 shrink-0 truncate text-gray-400" title={span.nodeName}>
            {span.nodeName}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${span.status === 'error' ? 'bg-red-500' : 'bg-accent'}`}
              style={{ width: `${Math.max(2, (span.durationMs / maxDuration) * 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right tabular-nums text-gray-500">
            {formatMs(span.durationMs)}
          </span>
          <span className="w-16 shrink-0 text-right tabular-nums text-gray-500">
            {formatCost(span.costUsd)}
          </span>
        </div>
      ))}
    </div>
  )
}
