/**
 * spanHelpers — convenience wrappers around useSpanStore for use inside
 * simulationStore's executeCurrent and runSubgraph.
 *
 * These are plain functions (not hooks) so they can be called inside async
 * logic without violating React hook rules.
 */
import { useSpanStore } from '../store/spanStore'
import type { TraceEntry } from '../types'

/**
 * Open a span for a node execution. Call at the top of executeCurrent,
 * before any await. Returns the spanId to pass into closeSpan.
 */
export function openSpan(
  nodeId: string,
  nodeType: string,
  parentSpanId?: string,
): string {
  return useSpanStore.getState().startSpan(nodeId, nodeType, parentSpanId)
}

/**
 * Close a span using the final TraceEntry status. Tolerates a null/undefined
 * spanId gracefully so callers don't need to guard.
 */
export function closeSpan(
  spanId: string | null | undefined,
  entry: Pick<TraceEntry, 'status'>,
  output?: unknown,
): void {
  if (!spanId) return
  useSpanStore.getState().endSpan(spanId, entry.status as Parameters<typeof useSpanStore.getState().endSpan>[1], output)
}

/**
 * Reset all spans at the start/stop of a run. Call alongside resetRunState.
 */
export function resetSpans(): void {
  useSpanStore.getState().resetSpans()
}
