import { ViewportPortal } from '@xyflow/react'
import { Group } from 'lucide-react'
import { useCanvasStore } from '../store/canvasStore'

/**
 * Floating toolbar shown above the bounding box of a 2+ node selection.
 * Rendered through ViewportPortal so it tracks pan/zoom in flow coordinates.
 */
export function SelectionToolbar() {
  const nodes = useCanvasStore((s) => s.nodes)
  const groupSelected = useCanvasStore((s) => s.groupSelected)

  const targets = nodes.filter(
    (n) => n.selected && n.type !== 'group' && !n.parentId,
  )
  if (targets.length < 2) return null

  const minX = Math.min(...targets.map((n) => n.position.x))
  const minY = Math.min(...targets.map((n) => n.position.y))

  return (
    <ViewportPortal>
      <div
        style={{ transform: `translate(${minX}px, ${minY - 44}px)` }}
        className="pointer-events-auto absolute z-10"
      >
        <button
          onClick={groupSelected}
          className="flex items-center gap-1.5 rounded-md border border-accent/50 bg-surface px-2.5 py-1.5 text-xs text-accent shadow-lg transition-colors hover:bg-surface-2"
        >
          <Group size={13} />
          Group {targets.length} nodes
        </button>
      </div>
    </ViewportPortal>
  )
}
