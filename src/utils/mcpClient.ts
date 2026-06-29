/**
 * Plain-fetch MCP (Model Context Protocol) client — no SDKs. All calls are
 * browser-side; failures (network, CORS, timeouts) reject with a
 * human-readable Error message.
 */
import type { MCPTool } from '../types'

function isLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')
}

/**
 * Enforce https: for MCP server URLs — the Authorization bearer token rides
 * on every call, so plain http: would leak it on the wire. localhost is
 * exempted outside production builds, since local MCP dev servers rarely
 * have TLS configured.
 */
export function validateMcpUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return `Invalid MCP server URL: ${url}`
  }
  if (parsed.protocol === 'https:') return null
  if (import.meta.env.DEV && isLocalHostname(parsed.hostname)) return null
  return `MCP server URL must use https: (got ${parsed.protocol.replace(':', '')}://${parsed.hostname})`
}

interface JsonRpcResponse {
  result?: {
    tools?: { name: string; description?: string; inputSchema?: Record<string, unknown> }[]
    content?: unknown
    [key: string]: unknown
  }
  error?: { message?: string }
}

/**
 * Read a JSON-RPC reply that may be a plain JSON body or an SSE stream
 * (`text/event-stream`), which spec-compliant Streamable-HTTP servers use.
 * Returns the first event carrying a result/error.
 */
async function readJsonRpc(response: Response): Promise<JsonRpcResponse | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    return (await response.json()) as JsonRpcResponse
  }
  const text = await response.text()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    try {
      const parsed = JSON.parse(trimmed.slice(5).trim()) as JsonRpcResponse
      if (parsed.result !== undefined || parsed.error !== undefined) {
        return parsed
      }
    } catch {
      // Skip non-JSON SSE comment/heartbeat lines.
    }
  }
  return null
}

/**
 * Open a session against an MCP server (Streamable HTTP transport) by
 * performing the spec handshake — `initialize` → `notifications/initialized`
 * — and return a `post` helper that carries the resulting `mcp-session-id`
 * (if issued) on subsequent calls.
 */
async function openSession(
  serverUrl: string,
  authToken?: string,
  signal?: AbortSignal,
): Promise<(body: unknown) => Promise<Response>> {
  const urlError = validateMcpUrl(serverUrl)
  if (urlError) throw new Error(urlError)

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  }
  if (authToken) headers.authorization = `Bearer ${authToken}`
  const post = (body: unknown): Promise<Response> => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    signal?.addEventListener('abort', () => controller.abort(), { once: true })
    return fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timeout))
  }

  let initResponse: Response
  try {
    initResponse = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'AgentFlow Studio', version: '1.0.0' },
      },
    })
  } catch {
    throw new Error(`MCP server not reachable at ${serverUrl}`)
  }
  if (!initResponse.ok) {
    throw new Error(`MCP server responded with ${initResponse.status}`)
  }
  // Carry the session id (if issued) through the rest of the handshake.
  const sessionId = initResponse.headers.get('mcp-session-id')
  if (sessionId) headers['mcp-session-id'] = sessionId
  const init = await readJsonRpc(initResponse)
  if (init?.error) {
    throw new Error(init.error.message ?? 'MCP initialize failed')
  }

  try {
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
  } catch {
    // Best-effort: some servers don't require the notification.
  }

  return post
}

/**
 * Query an MCP server for its full tool list (name, description, JSON Schema
 * input shape) via `tools/list`, using the spec initialize handshake.
 */
export async function listTools(
  serverUrl: string,
  authToken?: string,
): Promise<MCPTool[]> {
  const post = await openSession(serverUrl, authToken)
  let listResponse: Response
  try {
    listResponse = await post({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    })
  } catch {
    throw new Error(`MCP server not reachable at ${serverUrl}`)
  }
  if (!listResponse.ok) {
    throw new Error(`MCP server responded with ${listResponse.status}`)
  }
  const data = await readJsonRpc(listResponse)
  if (data?.error) {
    throw new Error(data.error.message ?? 'MCP server returned an error')
  }
  return (data?.result?.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description ?? '',
    inputSchema: t.inputSchema ?? {},
  }))
}

/**
 * Invoke a tool on an MCP server via `tools/call`, returning the raw `result`
 * from the JSON-RPC response.
 */
export async function callTool(
  serverUrl: string,
  authToken: string | undefined,
  name: string,
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const post = await openSession(serverUrl, authToken, signal)
  let callResponse: Response
  try {
    callResponse = await post({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name, arguments: input },
    })
  } catch {
    throw new Error(`MCP server not reachable at ${serverUrl}`)
  }
  if (!callResponse.ok) {
    throw new Error(`MCP server responded with ${callResponse.status}`)
  }
  const data = await readJsonRpc(callResponse)
  if (data?.error) {
    throw new Error(data.error.message ?? 'MCP server returned an error')
  }
  return data?.result ?? null
}
