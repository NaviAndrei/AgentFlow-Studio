/**
 * Plain-fetch MCP (Model Context Protocol) client — no SDKs. All calls are
 * browser-side; failures (network, CORS, timeouts) reject with a
 * human-readable Error message.
 */

interface JsonRpcResponse {
  result?: { tools?: { name: string }[] }
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
 * Query an MCP server (Streamable HTTP transport) for its tool list. Performs
 * the spec handshake — `initialize` → `notifications/initialized` →
 * `tools/list` — on one session (honoring the `mcp-session-id` header), since
 * compliant servers reject calls made before initialization.
 */
export async function discoverMcpTools(serverUrl: string): Promise<string[]> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  }
  const post = (body: unknown): Promise<Response> =>
    fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })

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
  return (data?.result?.tools ?? []).map((t) => t.name)
}
