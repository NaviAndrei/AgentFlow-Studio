import { ViewportPortal } from '@xyflow/react'
import { Group } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '../store/canvasStore'

/**
 * Floating toolbar shown above the bounding box of a 2+ node selection.
 * Rendered through ViewportPortal so it tracks pan/zoom in flow coordinates.
 */
export function SelectionToolbar() {
  // Select the already-reduced {count, minX, minY} with shallow equality, so a
  // drag that only moves the selection re-renders this once per frame at most.
  const summary = useCanvasStore(
    useShallow((s) => {
      let count = 0
      let minX = Infinity
      let minY = Infinity
      for (const n of s.nodes) {
        if (!n.selected || n.type === 'group' || n.parentId) continue
        count += 1
        if (n.position.x < minX) minX = n.position.x
        if (n.position.y < minY) minY = n.position.y
      }
      return { count, minX, minY }
    }),
  )
  const groupSelected = useCanvasStore((s) => s.groupSelected)

  if (summary.count < 2) return null
  const { minX, minY } = summary

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
          Group {summary.count} nodes
        </button>
      </div>
    </ViewportPortal>
  )
}
