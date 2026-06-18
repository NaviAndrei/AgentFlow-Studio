import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Check, Minus, TriangleAlert, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import type { NodeMeta } from './registry'
import type { AgentFlowNodeData } from '../types'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'
import { StreamingText } from '../components/StreamingText'
import { ICON_OPTIONS } from './iconOptions'

interface NodeShellProps {
  id: string
  meta: NodeMeta
  data: AgentFlowNodeData
  selected?: boolean
  hasInput?: boolean
  hasOutput?: boolean
  /** Named source handles (e.g. one per discovered MCP tool); replaces the single output port. */
  extraOutputs?: string[]
  /** Named bottom-edge source handles with custom colors (e.g. Try/Catch onSuccess/onError). */
  bottomHandles?: { id: string; side: 'left' | 'right'; color: string; title?: string }[]
  children?: ReactNode
}

export function NodeShell({
  id,
  meta,
  data,
  selected,
  hasInput = true,
  hasOutput = true,
  extraOutputs,
  bottomHandles,
  children,
}: NodeShellProps) {
  const [editingLabel, setEditingLabel] = useState(false)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const issueLevel = useCanvasStore((s) => {
    let level: 'error' | 'warning' | null = null
    for (const issue of s.validationIssues) {
      if (issue.nodeId !== id) continue
      if (issue.level === 'error') return 'error'
      level = 'warning'
    }
    return level
  })
  const issueTitle = useCanvasStore((s) =>
    s.validationIssues
      .filter((i) => i.nodeId === id)
      .map((i) => i.message)
      .join('\n'),
  )
  const simStatus = useSimulationStore(
    (s): 'active' | 'completed' | 'error' | 'skipped' | null => {
      if (!s.isActive) return null
      if (s.erroredNodeIds.includes(id)) return 'error'
      if (s.skippedNodeIds.has(id)) return 'skipped'
      if (id === s.activeId) return 'active'
      if (s.executedIds.has(id)) return 'completed'
      return null
    },
  )
  const executedLive = useSimulationStore(
    (s) => s.isActive && s.nodeEngines[id] === 'live',
  )
  const stream = useSimulationStore((s) =>
    s.isActive ? (s.nodeStreams[id] ?? '') : '',
  )
  const outputBadge = useSimulationStore((s) => {
    if (!s.isActive) return null
    const entry = s.trace.filter((e) => e.nodeId === id).at(-1)
    return entry && entry.output ? entry : null
  })

  const Icon = (data.icon ? ICON_OPTIONS[data.icon] : undefined) ?? meta.icon
  const headerColor = data.color ?? meta.color
  return (
    <div className="relative">
      <div
        className={`relative w-52 overflow-hidden rounded-lg border bg-surface text-xs shadow-lg transition-colors ${
          selected ? 'border-accent shadow-accent/20' : 'border-white/10'
        } ${simStatus === 'active' ? 'sim-active' : ''} ${
          simStatus === 'completed' ? 'opacity-60' : ''
        } ${simStatus === 'skipped' ? 'opacity-35' : ''} ${
          simStatus === 'error' ? 'sim-error' : ''
        }`}
      >
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ backgroundColor: headerColor }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditingLabel(true)
          }}
        >
          <Icon size={14} className="shrink-0 text-white" />
          {editingLabel ? (
            <input
              autoFocus
              className="nodrag w-full rounded bg-black/30 px-1 font-semibold text-white outline-none"
              value={data.label}
              onChange={(e) => updateNodeData(id, { label: e.target.value })}
              onBlur={() => setEditingLabel(false)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' || e.key === 'Escape') setEditingLabel(false)
              }}
            />
          ) : (
            <span className="truncate font-semibold text-white">{data.label}</span>
          )}
        </div>
        {children ? (
          <div className="space-y-1 px-3 py-2 text-gray-400">{children}</div>
        ) : null}
        {simStatus === 'active' && stream !== '' && (
          <div className="border-t border-white/10 px-3 py-2">
            <StreamingText
              text={stream}
              mode={
                meta.type === 'tool' || meta.type === 'memory'
                  ? 'lines'
                  : 'chars'
              }
            />
          </div>
        )}
        {simStatus === 'active' && (
          <div className="sim-breathe pointer-events-none absolute inset-0 rounded-lg" />
        )}
        {simStatus === 'completed' && (
          <div className="pointer-events-none absolute inset-0 rounded-lg bg-green-500/10" />
        )}
      </div>
      {outputBadge && (simStatus === 'completed' || simStatus === 'error') && (
        <div
          title={`INPUT:\n${outputBadge.input}\n\nOUTPUT:\n${outputBadge.output}`}
          className={`nodrag mt-1 w-52 cursor-default truncate rounded border px-2 py-0.5 text-[10px] ${
            outputBadge.status === 'cached'
              ? 'border-gray-500/60 bg-gray-500/10 text-gray-300'
              : outputBadge.status === 'ok'
                ? 'border-green-500/60 bg-green-500/10 text-green-300'
                : 'border-red-500/60 bg-red-500/10 text-red-300'
          }`}
        >
          {outputBadge.status === 'cached' ? `⚡ cached: ${outputBadge.output}` : outputBadge.output}
        </div>
      )}
      {simStatus === 'completed' && (
        <span
          title="Executed"
          className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-700"
        >
          <Check size={10} className="text-white" />
        </span>
      )}
      {simStatus === 'skipped' && (
        <span
          title="Skipped — branch not taken"
          className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-600"
        >
          <Minus size={10} className="text-white" />
        </span>
      )}
      {executedLive && (
        <span
          title="Executed live"
          className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500"
        >
          <Zap size={9} className="text-black" />
        </span>
      )}
      {issueLevel && (
        <span
          title={issueTitle}
          className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${
            issueLevel === 'error' ? 'bg-red-600' : 'bg-yellow-500'
          }`}
        >
          <TriangleAlert size={10} className="text-white" />
        </span>
      )}
      {hasInput && <Handle type="target" position={Position.Left} />}
      {hasOutput && (!extraOutputs || extraOutputs.length === 0) && (
        <Handle type="source" position={Position.Right} />
      )}
      {extraOutputs?.map((name, index) => (
        <Handle
          key={name}
          id={name}
          type="source"
          position={Position.Right}
          title={name}
          style={{ top: 46 + index * 16 }}
        />
      ))}
      {bottomHandles?.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={Position.Bottom}
          title={h.title ?? h.id}
          style={{
            left: h.side === 'left' ? '30%' : '70%',
            background: h.color,
          }}
        />
      ))}
    </div>
  )
}

export function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-gray-500">{k}</span>
      <span className="truncate text-gray-300">{v}</span>
    </div>
  )
}
