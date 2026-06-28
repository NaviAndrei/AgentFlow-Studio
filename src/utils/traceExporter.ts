import type { RunSpan } from '../types'

/** Serializes a run's spans into an OpenTelemetry-compatible JSON trace (Langfuse/Jaeger import format). */
export function exportTraceAsJSON(runId: string, spans: RunSpan[]): string {
  const otelSpans = spans.map((span) => ({
    traceId: runId,
    spanId: span.spanId,
    name: span.nodeName,
    startTimeUnixNano: span.startTime * 1_000_000,
    endTimeUnixNano: span.endTime * 1_000_000,
    attributes: {
      tokensIn: span.tokensIn,
      tokensOut: span.tokensOut,
      costUsd: span.costUsd,
      status: span.status,
      nodeType: span.nodeType,
      nodeId: span.nodeId,
    },
  }))
  return JSON.stringify({ traceId: runId, spans: otelSpans }, null, 2)
}
