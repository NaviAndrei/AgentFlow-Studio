import { useMemo } from 'react'
import { NODE_META } from '../nodes'
import type { Blueprint } from '../types'

const VIEW_W = 240
const VIEW_H = 84
const PAD = 10

/**
 * Mini map of a blueprint: node positions scaled into a fixed viewBox with
 * edges as lines and nodes as colored dots. Pure function of the blueprint
 * JSON — no React Flow, no screenshots.
 */
export function BlueprintThumbnail({ blueprint }: { blueprint: Blueprint }) {
  const { dots, lines } = useMemo(() => {
    const drawn = blueprint.nodes.filter((n) => n.type !== 'group')
    const xs = drawn.map((n) => n.position.x)
    const ys = drawn.map((n) => n.position.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = maxX - minX || 1
    const spanY = maxY - minY || 1
    const project = (x: number, y: number) => ({
      x: PAD + ((x - minX) / spanX) * (VIEW_W - PAD * 2),
      y: PAD + ((y - minY) / spanY) * (VIEW_H - PAD * 2),
    })
    const positions = new Map(
      drawn.map((n) => [n.id, project(n.position.x, n.position.y)]),
    )
    const dots = drawn.map((n) => ({
      id: n.id,
      ...project(n.position.x, n.position.y),
      color: NODE_META[n.type]?.color ?? '#3a4150',
    }))
    const lines = blueprint.edges
      .map((e) => {
        const a = positions.get(e.source)
        const b = positions.get(e.target)
        return a && b ? { id: e.id, a, b } : null
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)
    return { dots, lines }
  }, [blueprint])

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-16 w-full rounded-md border border-white/5 bg-canvas"
      role="img"
      aria-label={`${blueprint.name} graph preview`}
    >
      {lines.map((l) => (
        <line
          key={l.id}
          x1={l.a.x}
          y1={l.a.y}
          x2={l.b.x}
          y2={l.b.y}
          stroke="#3a4150"
          strokeWidth={1}
        />
      ))}
      {dots.map((d) => (
        <circle key={d.id} cx={d.x} cy={d.y} r={4} fill={d.color} />
      ))}
    </svg>
  )
}
