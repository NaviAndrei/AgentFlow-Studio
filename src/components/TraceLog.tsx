import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { ChevronDown, Trash2, Zap } from 'lucide-react'
import { getNodeMeta } from '../nodes'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'
import { HintIcon } from './HintIcon'
import { HINTS } from '../data/hints'
import type { TraceEntry } from '../types'

type TraceFilter = 'all' | 'errors' | 'llm' | 'tools'

const FILTERS: { key: TraceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'errors', label: 'Errors' },
  { key: 'llm', label: 'LLM Calls' },
  { key: 'tools', label: 'Tool Calls' },
]

const LLM_TYPES = ['llm', 'agent', 'supervisor', 'swarmWorker', 'router', 'guardrail']
const TOOL_TYPES = ['tool', 'retriever', 'mcpServer']

function matchesFilter(entry: TraceEntry, filter: TraceFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'errors':
      return entry.status === 'error'
    case 'llm':
      return LLM_TYPES.includes(entry.nodeType)
    case 'tools':
      return TOOL_TYPES.includes(entry.nodeType)
  }
}

function formatTime(at: number): string {
  const d = new Date(at)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/** A single trace row; reused by TraceLog (live) and RunHistoryPanel (read-only snapshot). */
export function TraceEntryRow({
  entry,
  onClick,
}: {
  entry: TraceEntry
  onClick?: (entry: TraceEntry) => void
}) {
  const meta = getNodeMeta(entry.nodeType)
  return (
    <button
      onClick={onClick ? () => onClick(entry) : undefined}
      disabled={!onClick}
      className={`grid w-full grid-cols-[90px_minmax(90px,140px)_60px_56px_1fr] items-center gap-2 rounded px-2 py-1 text-left text-[10px] transition-colors ${
        onClick ? 'hover:bg-surface-2' : ''
      }`}
    >
      <span className="tabular-nums text-gray-600">{formatTime(entry.at)}</span>
      <span className="flex items-center gap-1.5 truncate text-gray-300">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            entry.status === 'error'
              ? 'bg-red-500'
              : entry.status === 'skipped'
                ? 'bg-gray-600'
                : 'bg-green-500'
          }`}
        />
        <span className={`truncate ${entry.status === 'skipped' ? 'text-gray-500' : ''}`}>
          {entry.nodeName}
        </span>
        {entry.engine === 'live' && (
          <Zap size={9} className="shrink-0 text-amber-400" aria-label="Executed live" />
        )}
      </span>
      <span style={{ color: meta?.color }} className="truncate">
        {entry.nodeType}
      </span>
      <span className="tabular-nums text-gray-500">{entry.durationMs}ms</span>
      <span className="truncate text-gray-500">
        {entry.input} <span className="text-gray-700">→</span> {entry.output}
      </span>
    </button>
  )
}

export function TraceLog() {
  const traceOpen = useSimulationStore((s) => s.traceOpen)
  const setTraceOpen = useSimulationStore((s) => s.setTraceOpen)
  const trace = useSimulationStore((s) => s.trace)
  const clearTrace = useSimulationStore((s) => s.clearTrace)
  const selectOnly = useCanvasStore((s) => s.selectOnly)
  const { setCenter } = useReactFlow()
  const [filter, setFilter] = useState<TraceFilter>('all')

  const entries = trace.filter((e) => matchesFilter(e, filter))

  const focusNode = (entry: TraceEntry) => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === entry.nodeId)
    if (!node) return
    selectOnly(entry.nodeId)
    void setCenter(node.position.x + 104, node.position.y + 40, {
      zoom: 1.2,
      duration: 500,
    })
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-12 z-20 flex h-60 flex-col border-t border-white/10 bg-surface shadow-2xl transition-transform duration-300 ${
        traceOpen ? 'translate-y-0' : 'translate-y-[calc(100%+3rem)]'
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Execution Trace
          <HintIcon text={HINTS.trace.title} />
        </span>
        <div className="ml-2 flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
                filter === f.key
                  ? 'bg-accent/15 text-accent'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <Zap size={9} className="text-amber-400" />
          live
          <HintIcon text={HINTS.trace.engineLive} />
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          ms
          <HintIcon text={HINTS.trace.durationMs} />
        </span>
        <button
          onClick={clearTrace}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-gray-500 transition-colors hover:text-gray-300"
        >
          <Trash2 size={11} />
          Clear
        </button>
        <button
          onClick={() => setTraceOpen(false)}
          aria-label="Close trace log"
          className="rounded-md p-0.5 text-gray-500 hover:text-gray-300"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {entries.length === 0 && (
          <p className="px-2 py-3 text-[11px] text-gray-600">
            {trace.length === 0
              ? 'No executions logged yet — run the simulation.'
              : 'No entries match this filter.'}
          </p>
        )}
        {entries.map((entry) => (
          <TraceEntryRow key={entry.id} entry={entry} onClick={focusNode} />
        ))}
      </div>
    </div>
  )
}
