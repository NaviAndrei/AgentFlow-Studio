/**
 * One-click shareable flow URLs: the canvas graph is serialized, deflated,
 * and base64url-encoded into a `?flow=` query param. No backend required.
 */
import type { AgentFlowEdge, AgentFlowNode } from '../types'

/** Serialize + compress + base64 the graph into a `?flow=` URL. */
// SHARE GROUP FIELDS: confirmed present in AgentFlowNode type
export async function encodeFlow(
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
): Promise<string> {
  const { deflateSync, strToU8 } = await import('fflate')
  const json = JSON.stringify({ v: 1, nodes, edges })
  const compressed = deflateSync(strToU8(json), { level: 9 })
  const b64 = btoa(String.fromCharCode(...compressed))
  const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const url = new URL(window.location.href)
  url.searchParams.set('flow', urlSafe)
  return url.toString()
}

/** Decode a `?flow=` param back into nodes + edges, or null if invalid. */
export async function decodeFlow(
  param: string,
): Promise<{ nodes: AgentFlowNode[]; edges: AgentFlowEdge[] } | null> {
  try {
    const { inflateSync, strFromU8 } = await import('fflate')
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      param.length + ((4 - (param.length % 4)) % 4),
      '=',
    )
    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const json = strFromU8(inflateSync(binary))
    const parsed = JSON.parse(json)
    if (parsed.v !== 1 || !Array.isArray(parsed.nodes)) return null
    return { nodes: parsed.nodes, edges: parsed.edges ?? [] }
  } catch {
    return null
  }
}
