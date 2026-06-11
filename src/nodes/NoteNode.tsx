import { StickyNote } from 'lucide-react'
import type { NodeProps } from '@xyflow/react'
import type { AgentFlowNode } from '../types'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'

/** Flow-distance threshold for treating a note as "adjacent" to a node. */
const ADJACENCY_RADIUS = 420

export function NoteNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  // During simulation a note reveals its full text while the nearest flow
  // node (within ADJACENCY_RADIUS) is the active one.
  const revealed = useSimulationStore((s) => {
    if (!s.isActive) return false
    const activeId = s.activeId
    if (!activeId) return false
    const nodes = useCanvasStore.getState().nodes
    const active = nodes.find((n) => n.id === activeId)
    const note = nodes.find((n) => n.id === id)
    if (!active || !note) return false
    return (
      Math.hypot(
        active.position.x - note.position.x,
        active.position.y - note.position.y,
      ) < ADJACENCY_RADIUS
    )
  })
  const simActive = useSimulationStore((s) => s.isActive)

  return (
    <div
      className={`w-64 rounded-md border bg-[#1f1c12] px-3 py-2 text-xs leading-relaxed text-amber-200/80 transition-colors ${
        revealed
          ? 'border-accent shadow-lg shadow-accent/10'
          : selected
            ? 'border-accent'
            : 'border-amber-500/20'
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-amber-400/80">
        <StickyNote size={12} />
        <span className="font-semibold">{data.label}</span>
      </div>
      <p
        className={`whitespace-pre-wrap ${
          simActive && !revealed ? 'line-clamp-2 opacity-50' : ''
        }`}
      >
        {data.text ?? ''}
      </p>
    </div>
  )
}
