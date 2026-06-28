import type { A2AAgentCard } from '../types'

/**
 * A2A (Agent-to-Agent) v1.0 client — JSON-RPC 2.0 over plain `fetch`, no deps.
 * Every function is defensive: network/protocol errors resolve to null/error
 * shapes rather than throwing, so the simulation walker never crashes on a
 * misbehaving remote agent.
 */

interface JsonRpcResponse {
  result?: {
    id?: string
    status?: { state?: string }
    artifacts?: Array<{ parts?: Array<{ text?: string }> }>
    error?: { message?: string }
  }
  error?: { message?: string }
}

function authHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  return headers
}

/** Discover an agent's card. Returns null on any error (never throws). */
export async function fetchAgentCard(
  agentUrl: string,
): Promise<A2AAgentCard | null> {
  try {
    const url = `${agentUrl.replace(/\/+$/, '')}/.well-known/agent.json`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    const data = (await resp.json()) as Partial<A2AAgentCard>
    if (!data || typeof data.name !== 'string') return null
    return {
      name: data.name,
      description: data.description,
      skills: Array.isArray(data.skills) ? data.skills : [],
    }
  } catch {
    return null
  }
}

/**
 * Send a message/send task. The task id is server-generated — extracted from
 * the response, never pre-generated client-side.
 */
export async function sendA2ATask(
  agentUrl: string,
  inputText: string,
  skillId?: string,
  authToken?: string,
): Promise<{ taskId: string; error?: string }> {
  try {
    const body = {
      jsonrpc: '2.0',
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: inputText }],
          ...(skillId ? { skillId } : {}),
        },
      },
      id: crypto.randomUUID(),
    }
    const resp = await fetch(agentUrl, {
      method: 'POST',
      headers: authHeaders(authToken),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return { taskId: '', error: `A2A send failed: HTTP ${resp.status}` }
    const data = (await resp.json()) as JsonRpcResponse
    if (data.error) return { taskId: '', error: data.error.message ?? 'A2A error' }
    const taskId = data.result?.id
    if (!taskId) return { taskId: '', error: 'A2A response missing task id' }
    return { taskId }
  } catch (error) {
    return {
      taskId: '',
      error: error instanceof Error ? error.message : 'A2A send failed',
    }
  }
}

/** Poll tasks/get until a terminal state, timeout, or attempt cap. */
export async function pollA2ATask(
  agentUrl: string,
  taskId: string,
  config: {
    pollIntervalMs: number
    maxPollAttempts: number
    authToken?: string
  },
  onStatusUpdate?: (status: string) => void,
): Promise<{ output: string; status: string; error?: string }> {
  for (let attempt = 0; attempt < config.maxPollAttempts; attempt++) {
    let data: JsonRpcResponse
    try {
      const body = {
        jsonrpc: '2.0',
        method: 'tasks/get',
        params: { id: taskId },
        id: crypto.randomUUID(),
      }
      const resp = await fetch(agentUrl, {
        method: 'POST',
        headers: authHeaders(config.authToken),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) return { output: '', status: 'failed', error: `HTTP ${resp.status}` }
      data = (await resp.json()) as JsonRpcResponse
    } catch (error) {
      return {
        output: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'A2A poll failed',
      }
    }

    if (data.error)
      return { output: '', status: 'failed', error: data.error.message ?? 'A2A error' }

    const status = data.result?.status?.state ?? 'working'
    onStatusUpdate?.(status)

    if (status === 'completed') {
      const output = data.result?.artifacts?.[0]?.parts?.[0]?.text ?? ''
      return { output, status: 'completed' }
    }
    if (status === 'failed' || status === 'canceled') {
      return {
        output: '',
        status,
        error: data.result?.error?.message ?? status,
      }
    }

    await new Promise((r) => setTimeout(r, config.pollIntervalMs))
  }
  return { output: '', status: 'timeout', error: 'A2A task timed out' }
}
