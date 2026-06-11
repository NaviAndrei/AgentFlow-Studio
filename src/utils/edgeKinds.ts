import { MarkerType } from '@xyflow/react'
import type { Edge } from '@xyflow/react'
import type { EdgeKind } from '../types'

export const BIDIRECTIONAL_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
  color: '#9ca3af',
}

/** Marker props for an edge of the given kind. */
export function markersForKind(
  kind: EdgeKind,
): Pick<Edge, 'markerStart' | 'markerEnd'> {
  return kind === 'bidirectional'
    ? { markerStart: BIDIRECTIONAL_MARKER, markerEnd: BIDIRECTIONAL_MARKER }
    : { markerStart: undefined, markerEnd: undefined }
}
