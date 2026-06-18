import type { RunRecord, TraceEntry } from '../types'

export interface NodeDiff {
  nodeId: string
  nodeLabel: string
  statusA: TraceEntry['status'] | null
  statusB: TraceEntry['status'] | null
  outputA: string | null
  outputB: string | null
  durationDeltaMs: number
}

function lastByNode(trace: TraceEntry[]): Map<string, TraceEntry> {
  const map = new Map<string, TraceEntry>()
  for (const entry of trace) map.set(entry.nodeId, entry)
  return map
}

/** Pure comparison of two runs' final per-node trace entries. No side effects. */
export function diffRuns(runA: RunRecord, runB: RunRecord): NodeDiff[] {
  const a = lastByNode(runA.traceSnapshot)
  const b = lastByNode(runB.traceSnapshot)
  const nodeIds = new Set([...a.keys(), ...b.keys()])
  const diffs: NodeDiff[] = []
  for (const nodeId of nodeIds) {
    const ea = a.get(nodeId) ?? null
    const eb = b.get(nodeId) ?? null
    const statusA = ea?.status ?? null
    const statusB = eb?.status ?? null
    const outputA = ea?.output ?? null
    const outputB = eb?.output ?? null
    const durationDeltaMs = (eb?.durationMs ?? 0) - (ea?.durationMs ?? 0)
    if (statusA === statusB && outputA === outputB && durationDeltaMs === 0) continue
    diffs.push({
      nodeId,
      nodeLabel: eb?.nodeName ?? ea?.nodeName ?? nodeId,
      statusA,
      statusB,
      outputA,
      outputB,
      durationDeltaMs,
    })
  }
  return diffs
}
