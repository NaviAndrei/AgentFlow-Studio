import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { encodeFlow, decodeFlow } from './shareUrl'
import type { AgentFlowNode, AgentFlowEdge } from '../types'

describe('shareUrl', () => {
  beforeAll(() => {
    // Stub global location object to make URL operations predictable
    vi.stubGlobal('location', {
      href: 'http://localhost:3000/app',
    })
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  const sampleNodes: AgentFlowNode[] = [
    {
      id: 'node-1',
      type: 'start',
      position: { x: 100, y: 150 },
      data: { label: 'Start Node' },
    },
  ]

  const sampleEdges: AgentFlowEdge[] = [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
    },
  ]

  it('encodes nodes and edges into a flow query parameter URL', async () => {
    const urlString = await encodeFlow(sampleNodes, sampleEdges)
    const url = new URL(urlString)

    expect(url.origin).toBe('http://localhost:3000')
    expect(url.pathname).toBe('/app')
    expect(url.searchParams.has('flow')).toBe(true)

    const flowParam = url.searchParams.get('flow')
    expect(flowParam).toBeTruthy()
  })

  it('decodes encoded flow parameters back to nodes and edges', async () => {
    const urlString = await encodeFlow(sampleNodes, sampleEdges)
    const url = new URL(urlString)
    const flowParam = url.searchParams.get('flow')!

    const decoded = await decodeFlow(flowParam)
    expect(decoded).not.toBeNull()
    expect(decoded!.nodes).toHaveLength(1)
    expect(decoded!.nodes[0].id).toBe('node-1')
    expect(decoded!.nodes[0].data.label).toBe('Start Node')
    expect(decoded!.edges).toHaveLength(1)
    expect(decoded!.edges[0].id).toBe('edge-1')
  })

  it('returns null when decoding an invalid base64 flow parameter', async () => {
    const decoded = await decodeFlow('invalid-base64-string')
    expect(decoded).toBeNull()
  })

  it('returns null when decoded JSON version does not match 1', async () => {
    // JSON with version mismatch
    const badJson = JSON.stringify({ v: 2, nodes: [], edges: [] })
    const { deflateSync, strToU8 } = await import('fflate')
    const compressed = deflateSync(strToU8(badJson), { level: 9 })
    const b64 = btoa(String.fromCharCode(...compressed))
    const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    const decoded = await decodeFlow(urlSafe)
    expect(decoded).toBeNull()
  })

  it('returns null when decoded JSON does not have nodes array', async () => {
    // JSON without nodes array
    const badJson = JSON.stringify({ v: 1, edges: [] })
    const { deflateSync, strToU8 } = await import('fflate')
    const compressed = deflateSync(strToU8(badJson), { level: 9 })
    const b64 = btoa(String.fromCharCode(...compressed))
    const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    const decoded = await decodeFlow(urlSafe)
    expect(decoded).toBeNull()
  })
})
