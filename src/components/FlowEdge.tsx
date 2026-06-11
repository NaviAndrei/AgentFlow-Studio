import { useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import { useCanvasStore } from '../store/canvasStore'
import {
  prefersReducedMotion,
  useSimulationStore,
} from '../store/simulationStore'
import { edgeDurationSec } from '../utils/fakeData'
import type { EdgeKind } from '../types'

const KIND_STYLES: Record<EdgeKind, React.CSSProperties> = {
  direct: { stroke: '#3a4150', strokeWidth: 1.5 },
  conditional: { stroke: '#ca8a04', strokeDasharray: '6 4', strokeWidth: 1.5 },
  bidirectional: { stroke: '#3a4150', strokeWidth: 1.5 },
}

const PARTICLE_COUNT = 5
const FANOUT_STAGGER_SEC = 0.2

type ParticleRole = 'incoming' | 'fanout' | null

interface ParticlesProps {
  path: string
  durSec: number
  role: Exclude<ParticleRole, null>
  fanIndex: number
  /** Fade particles out along the path (parent particle entering a fan-out). */
  fade: boolean
  trailFilterId: string
}

/**
 * 5 particles per active edge. Incoming particles use negative begin times so
 * the stream is pre-distributed along the path; fan-out particles spawn with a
 * 200ms stagger per child edge. Each particle drags two blurred, lower-opacity
 * copies behind it as a fading trail (skipped under prefers-reduced-motion).
 */
function Particles({ path, durSec, role, fanIndex, fade, trailFilterId }: ParticlesProps) {
  const reduced = prefersReducedMotion()
  return (
    <>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const begin =
          role === 'fanout'
            ? fanIndex * FANOUT_STAGGER_SEC + (i * durSec) / PARTICLE_COUNT
            : -((i * durSec) / PARTICLE_COUNT)
        return (
          <g key={i}>
            <circle r={3.5} fill="#00c4cc">
              <animateMotion
                dur={`${durSec}s`}
                begin={`${begin}s`}
                repeatCount="indefinite"
                path={path}
              />
              {fade && !reduced && (
                <animate
                  attributeName="opacity"
                  values="1;0.1"
                  dur={`${durSec}s`}
                  begin={`${begin}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
            {!reduced && (
              <>
                <circle
                  r={3}
                  fill="#00c4cc"
                  opacity={0.4}
                  filter={`url(#${trailFilterId})`}
                >
                  <animateMotion
                    dur={`${durSec}s`}
                    begin={`${begin + 0.09}s`}
                    repeatCount="indefinite"
                    path={path}
                  />
                </circle>
                <circle
                  r={2.5}
                  fill="#00c4cc"
                  opacity={0.18}
                  filter={`url(#${trailFilterId})`}
                >
                  <animateMotion
                    dur={`${durSec}s`}
                    begin={`${begin + 0.18}s`}
                    repeatCount="indefinite"
                    path={path}
                  />
                </circle>
              </>
            )}
          </g>
        )
      })}
    </>
  )
}

export function FlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected,
  markerStart,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const updateEdgeLabel = useCanvasStore((s) => s.updateEdgeLabel)
  const removeEdge = useCanvasStore((s) => s.removeEdge)
  const targetType = useCanvasStore((s) => s.nodeTypeById[target])
  const sourceType = useCanvasStore((s) => s.nodeTypeById[source])
  const edgeErrored = useSimulationStore(
    (s) =>
      s.erroredNodeIds.includes(source) || s.erroredNodeIds.includes(target),
  )
  const particleRole = useSimulationStore((s): ParticleRole => {
    if (!s.isActive || s.activeId === null) return null
    if (target === s.activeId) {
      return s.executedIds.has(source) ? 'incoming' : null
    }
    if (source === s.activeId && sourceType === 'supervisor') return 'fanout'
    return null
  })

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const kind = (data?.edgeType as EdgeKind | undefined) ?? 'direct'
  const labelText = typeof label === 'string' ? label : ''
  const trailFilterId = `trail-${id}`

  // Fan-out stagger position and merge detection are derived from static
  // canvas data, so non-reactive reads are sufficient here.
  let fanIndex = 0
  let fadeParent = false
  let showMergeFlash = false
  if (particleRole === 'fanout') {
    const outs = useCanvasStore
      .getState()
      .edges.filter((e) => e.source === source)
    fanIndex = Math.max(
      0,
      outs.findIndex((e) => e.id === id),
    )
  } else if (particleRole === 'incoming') {
    fadeParent = targetType === 'supervisor'
    const sim = useSimulationStore.getState()
    const incomingActive = useCanvasStore
      .getState()
      .edges.filter((e) => e.target === target && sim.executedIds.has(e.source))
    // One edge (the first) owns the merge flash so it renders exactly once.
    showMergeFlash =
      incomingActive.length >= 2 && incomingActive[0]?.id === id
  }

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
    >
      <defs>
        <filter
          id={trailFilterId}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          ...KIND_STYLES[kind],
          ...(edgeErrored
            ? { stroke: '#dc143c' }
            : selected || particleRole
              ? { stroke: '#00c4cc' }
              : {}),
        }}
      />
      {particleRole && (
        <Particles
          path={edgePath}
          durSec={edgeDurationSec(targetType)}
          role={particleRole}
          fanIndex={fanIndex}
          fade={fadeParent}
          trailFilterId={trailFilterId}
        />
      )}
      {showMergeFlash && !prefersReducedMotion() && (
        <circle cx={targetX} cy={targetY} fill="#00c4cc" opacity={0.7}>
          <animate
            attributeName="r"
            values="3;15"
            dur="0.9s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
        >
          {editing ? (
            <input
              autoFocus
              placeholder="label…"
              className="w-28 rounded border border-accent/60 bg-surface-2 px-1.5 py-0.5 text-[10px] text-gray-200 outline-none"
              value={labelText}
              onChange={(e) => updateEdgeLabel(id, e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' || e.key === 'Escape') setEditing(false)
              }}
            />
          ) : labelText !== '' ? (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
              className={`rounded border px-1.5 py-0.5 text-[10px] ${
                kind === 'conditional'
                  ? 'border-yellow-600/40 bg-surface-2 text-yellow-500'
                  : 'border-white/10 bg-surface-2 text-gray-300'
              }`}
            >
              {labelText}
            </span>
          ) : null}
          {(hovered || selected) && !editing && (
            <button
              onClick={() => removeEdge(id)}
              title="Delete edge"
              className="flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-surface-2 text-gray-400 hover:border-red-500 hover:text-red-400"
            >
              <X size={9} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </g>
  )
}
