import { toPng } from 'html-to-image'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { AgentFlowNode } from '../types'

/**
 * Captures the ENTIRE graph (every node, including off-screen ones) as a PNG
 * at a fixed canvas size, without moving the user's live viewport. Computes a
 * transform that fits all nodes into the target image, then applies it only to
 * the html-to-image clone of `.react-flow__viewport` via the `style` override —
 * the real viewport is never mutated.
 */
export async function downloadFullGraphScreenshot(
  nodes: AgentFlowNode[],
  imageWidth = 2560,
  imageHeight = 1440,
): Promise<void> {
  if (nodes.length === 0) throw new Error('Canvas has no nodes to capture')

  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport) throw new Error('Canvas is not mounted')

  const bounds = getNodesBounds(nodes)
  const { x, y, zoom } = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    0.1,
    2,
    0.1,
  )

  const dataUrl = await toPng(viewport, {
    backgroundColor: '#0d0e10',
    width: imageWidth,
    height: imageHeight,
    // Skip web-font inlining: reading rules from the cross-origin Google Fonts
    // stylesheet throws a SecurityError and stalls the capture. Text falls back
    // to the system monospace face in the exported image.
    skipFonts: true,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = `agentflow-graph-${stamp}.png`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

/**
 * Captures the ReactFlow canvas (nodes + edges, current viewport) as a PNG
 * and triggers a browser download. Filters out the Controls/MiniMap so the
 * exported image only contains the flow itself.
 */
export async function downloadCanvasScreenshot(): Promise<void> {
  const flow = document.querySelector<HTMLElement>('.react-flow')
  if (!flow) throw new Error('Canvas is not mounted')

  const dataUrl = await toPng(flow, {
    backgroundColor: '#0d0e10',
    // See downloadFullGraphScreenshot — skip the stalling web-font inlining.
    skipFonts: true,
    filter: (node) =>
      !node.classList.contains('react-flow__minimap') &&
      !node.classList.contains('react-flow__controls'),
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = `agentflow-flow-${stamp}.png`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}
