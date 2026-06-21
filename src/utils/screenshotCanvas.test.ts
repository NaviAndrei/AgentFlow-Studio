import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadFullGraphScreenshot } from './screenshotCanvas'
import type { AgentFlowNode } from '../types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('downloadFullGraphScreenshot', () => {
  it('throws when there are no nodes to capture', async () => {
    await expect(downloadFullGraphScreenshot([])).rejects.toThrow(/no nodes/)
  })

  it('throws when the canvas viewport is not mounted', async () => {
    // Nodes present, but no .react-flow__viewport element in the DOM.
    vi.stubGlobal('document', { querySelector: () => null })
    const nodes = [
      { id: 'n1', type: 'llm', position: { x: 0, y: 0 }, data: { label: 'A' } },
    ] as AgentFlowNode[]
    await expect(downloadFullGraphScreenshot(nodes)).rejects.toThrow(
      /not mounted/,
    )
  })
})
