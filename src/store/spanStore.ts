/**
 * spanStore — lightweight in-memory span collector for execution tracing.
 *
 * Each node execution in simulationStore opens a span (startSpan) and closes it
 * (endSpan) with a status. Spans are accumulated per-run and reset on stop().
 * The store intentionally has no persistence — spans are diagnostic, ephemeral,
 * and should never bloat localStorage.
 *
 * Usage:
 *   import { useSpanStore } from './spanStore'
 *   const spanId = useSpanStore.getState().startSpan(nodeId, nodeType)
 *   useSpanStore.getState().endSpan(spanId, 'ok', output)
 */
import { create } from 'zustand'

export interface Span {
  id: string
  nodeId: string
  nodeType: string
  startedAt: number
  endedAt?: number
  durationMs?: number
  status: 'running' | 'ok' | 'error' | 'skipped' | 'cached'
  output?: unknown
  parentSpanId?: string
}

interface SpanState {
  spans: Span[]
  /** Open a new span for a node execution. Returns the span id. */
  startSpan: (nodeId: string, nodeType: string, parentSpanId?: string) => string
  /** Close an open span with a final status and optional output. */
  endSpan: (spanId: string, status: Span['status'], output?: unknown) => void
  /** Clear all spans (called on stop / start). */
  resetSpans: () => void
  /** Return all spans for a given nodeId (across loop iterations). */
  spansForNode: (nodeId: string) => Span[]
}

export const useSpanStore = create<SpanState>((set, get) => ({
  spans: [],

  startSpan: (nodeId, nodeType, parentSpanId) => {
    const id = crypto.randomUUID()
    const span: Span = {
      id,
      nodeId,
      nodeType,
      startedAt: Date.now(),
      status: 'running',
      parentSpanId,
    }
    set({ spans: [...get().spans, span] })
    return id
  },

  endSpan: (spanId, status, output) => {
    set({
      spans: get().spans.map((s) =>
        s.id === spanId
          ? {
              ...s,
              endedAt: Date.now(),
              durationMs: Date.now() - s.startedAt,
              status,
              output,
            }
          : s,
      ),
    })
  },

  resetSpans: () => set({ spans: [] }),

  spansForNode: (nodeId) => get().spans.filter((s) => s.nodeId === nodeId),
}))
