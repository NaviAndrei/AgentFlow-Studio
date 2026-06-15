import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { AlertCircle, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'
import { useUIStore } from '../store/uiStore'

export interface ProblemItem {
  id: string
  severity: 'error' | 'warning'
  nodeId: string | null
  nodeName: string
  nodeType: string
  message: string
  timestamp: number
}

type ProblemFilter = 'all' | 'error' | 'warning'

/**
 * Unified list of validation issues (canvasStore.validationIssues — live,
 * current state) and runtime trace errors (simulationStore.trace entries
 * with status === 'error'). No separate store: both sources are already
 * reactive, so the list clears itself when validation passes or a new run
 * resets the trace — no explicit "clear on run start" hook is needed.
 */
export function useProblemItems(): ProblemItem[] {
  const validationIssues = useCanvasStore((s) => s.validationIssues)
  const nodes = useCanvasStore((s) => s.nodes)
  const trace = useSimulationStore((s) => s.trace)

  return useMemo(() => {
    const items: ProblemItem[] = []
    const now = Date.now()

    validationIssues.forEach((issue, index) => {
      const node = issue.nodeId ? nodes.find((n) => n.id === issue.nodeId) : undefined
      items.push({
        id: `validation-${index}-${issue.nodeId ?? 'graph'}`,
        severity: issue.level,
        nodeId: issue.nodeId ?? null,
        nodeName: node?.data.label ?? (issue.nodeId ? issue.nodeId : 'Canvas'),
        nodeType: node?.type ?? 'graph',
        message: issue.message,
        timestamp: now,
      })
    })

    for (const entry of trace) {
      if (entry.status !== 'error') continue
      items.push({
        id: entry.id,
        severity: 'error',
        nodeId: entry.nodeId,
        nodeName: entry.nodeName,
        nodeType: entry.nodeType,
        message: entry.output,
        timestamp: entry.at,
      })
    }

    return items
  }, [validationIssues, nodes, trace])
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 5_000) return 'now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

const FILTERS: { key: ProblemFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'error', label: 'Errors' },
  { key: 'warning', label: 'Warnings' },
]

export function ProblemsPanel() {
  const open = useUIStore((s) => s.problemsPanelOpen)
  const setOpen = useUIStore((s) => s.setProblemsPanelOpen)
  const selectOnly = useCanvasStore((s) => s.selectOnly)
  const { setCenter } = useReactFlow()
  const [filter, setFilter] = useState<ProblemFilter>('all')

  const items = useProblemItems()
  const errorCount = items.filter((i) => i.severity === 'error').length
  const warningCount = items.filter((i) => i.severity === 'warning').length

  const filtered = items.filter((i) => filter === 'all' || i.severity === filter)

  const goToNode = (nodeId: string) => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
    if (!node) return
    selectOnly(nodeId)
    void setCenter(node.position.x + 104, node.position.y + 40, {
      zoom: 1.2,
      duration: 500,
    })
    setOpen(false)
  }

  return (
    <div
      className={`fixed right-0 top-12 bottom-12 z-20 flex w-96 flex-col border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <AlertCircle size={13} className="text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
          Problems
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            errorCount > 0
              ? 'bg-red-500/15 text-red-400'
              : warningCount > 0
                ? 'bg-yellow-500/15 text-yellow-400'
                : 'bg-white/5 text-gray-400'
          }`}
        >
          {items.length}
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close problems panel"
          className="ml-auto rounded-md p-0.5 text-gray-500 hover:text-gray-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-white/10 px-3 py-2">
        {FILTERS.map((f) => {
          const count =
            f.key === 'all'
              ? items.length
              : f.key === 'error'
                ? errorCount
                : warningCount
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
                filter === f.key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded border border-dashed border-white/10 px-2 py-6 text-center text-[10px] text-gray-600">
            <CheckCircle size={20} className="text-green-500" />
            <span className="text-gray-400">No problems detected</span>
          </div>
        )}
        {filtered.map((item) => (
          <div key={item.id} className="mb-2 rounded-md border border-white/10 bg-canvas p-2">
            <div className="mb-1 flex items-center gap-1.5">
              {item.severity === 'error' ? (
                <AlertCircle size={11} className="shrink-0 text-red-500" />
              ) : (
                <AlertTriangle size={11} className="shrink-0 text-yellow-500" />
              )}
              <span className="truncate rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-300">
                {item.nodeName}
              </span>
              <span className="shrink-0 text-[10px] text-gray-500">{item.nodeType}</span>
            </div>
            <p className="mb-1 line-clamp-2 text-[11px] text-gray-200">{item.message}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{formatRelativeTime(item.timestamp)}</span>
              {item.nodeId && (
                <button
                  onClick={() => goToNode(item.nodeId as string)}
                  className="text-[10px] text-accent hover:underline"
                >
                  → Go to node
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
