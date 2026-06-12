/**
 * Plain-fetch clients for external services (no SDKs). All calls are
 * browser-side; failures (network, CORS, timeouts) reject with a
 * human-readable Error message.
 */
import type { ChatMessage } from '../types'

export type LLMProvider = 'ollama' | 'gemini'
export type GeminiModel = 'gemini-flash' | 'gemini-pro'

export interface LLMConfig {
  provider: LLMProvider
  ollamaUrl: string
  ollamaModel: string
  geminiApiKey: string
  geminiModel: GeminiModel
}

const GEMINI_MODEL_IDS: Record<GeminiModel, string> = {
  'gemini-flash': 'gemini-1.5-flash',
  'gemini-pro': 'gemini-1.5-pro',
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * True when a URL points at a non-local host over plain HTTP — worth a
 * warning since prompts/responses would travel unencrypted. Unparseable
 * URLs return false (the fetch itself will surface the real error).
 */
export function isInsecureRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '::1' ||
      host.endsWith('.localhost')
    return !isLocal && parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/** Map abort/timeout DOMExceptions to readable messages; otherwise use the fallback. */
function fetchErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException) {
    if (error.name === 'AbortError') return 'Request cancelled'
    if (error.name === 'TimeoutError') return 'Request timed out'
  }
  return fallback
}

/** Milliseconds without a received chunk before a streaming call is aborted. */
const STREAM_IDLE_TIMEOUT_MS = 60_000

/**
 * Combine the caller's signal with an idle timer that must be `touch()`ed
 * whenever data arrives; silence between chunks longer than the timeout
 * aborts with a TimeoutError.
 */
function withIdleTimeout(signal: AbortSignal | undefined): {
  signal: AbortSignal
  touch: () => void
  clear: () => void
} {
  const idle = new AbortController()
  const abort = () =>
    idle.abort(new DOMException('Stream idle timeout', 'TimeoutError'))
  let timer = window.setTimeout(abort, STREAM_IDLE_TIMEOUT_MS)
  return {
    signal: signal ? AbortSignal.any([signal, idle.signal]) : idle.signal,
    touch: () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(abort, STREAM_IDLE_TIMEOUT_MS)
    },
    clear: () => window.clearTimeout(timer),
  }
}

export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  let response: Response
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    throw new Error(`Ollama not reachable at ${hostOf(baseUrl)}`)
  }
  if (!response.ok) {
    throw new Error(`Ollama responded with ${response.status}`)
  }
  const data = (await response.json()) as { models?: { name: string }[] }
  return (data.models ?? []).map((m) => m.name)
}

/**
 * Lightweight connectivity check for the Gemini key/model: a 1-output-token
 * generateContent call. Resolves on success, rejects with a readable Error.
 */
export async function testGeminiConnection(
  apiKey: string,
  model: GeminiModel,
): Promise<void> {
  if (apiKey.trim() === '') {
    throw new Error('Gemini API key is not set')
  }
  const modelId = GEMINI_MODEL_IDS[model]
  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch (error) {
    throw new Error(
      fetchErrorMessage(error, 'Gemini API not reachable (network or CORS error)'),
    )
  }
  if (!response.ok) {
    throw new Error(
      response.status === 400 || response.status === 401 || response.status === 403
        ? `Gemini rejected the API key (HTTP ${response.status})`
        : `Gemini responded with ${response.status}`,
    )
  }
}

/** Stream a chat completion; resolves with the full response text. */
export async function streamChat(
  config: LLMConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  return config.provider === 'ollama'
    ? streamOllama(config, messages, onChunk, signal)
    : streamGemini(config, messages, onChunk, signal)
}

async function streamOllama(
  config: LLMConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  callerSignal?: AbortSignal,
): Promise<string> {
  const { signal, touch, clear } = withIdleTimeout(callerSignal)
  let response: Response
  try {
    response = await fetch(
      `${config.ollamaUrl.replace(/\/+$/, '')}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: config.ollamaModel || 'llama3',
          messages,
          stream: true,
        }),
        signal,
      },
    )
  } catch (error) {
    clear()
    throw new Error(
      fetchErrorMessage(
        error,
        `Ollama not reachable at ${hostOf(config.ollamaUrl)}`,
      ),
    )
  }
  if (!response.ok || !response.body) {
    clear()
    throw new Error(`Ollama responded with ${response.status}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      touch()
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim() === '') continue
        try {
          const parsed = JSON.parse(line) as { message?: { content?: string } }
          const chunk = parsed.message?.content ?? ''
          if (chunk !== '') {
            full += chunk
            onChunk(chunk)
          }
        } catch {
          // Skip malformed/partial NDJSON lines.
        }
      }
    }
  } catch (error) {
    throw new Error(fetchErrorMessage(error, 'Ollama stream failed'))
  } finally {
    clear()
  }
  return full
}

async function streamGemini(
  config: LLMConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  callerSignal?: AbortSignal,
): Promise<string> {
  if (config.geminiApiKey.trim() === '') {
    throw new Error('Gemini API key is not set')
  }
  const { signal, touch, clear } = withIdleTimeout(callerSignal)
  const system = messages.find((m) => m.role === 'system')
  const body: Record<string, unknown> = {
    contents: messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
  }
  if (system) {
    body.systemInstruction = { parts: [{ text: system.content }] }
  }
  const modelId = GEMINI_MODEL_IDS[config.geminiModel]
  let response: Response
  try {
    // API key travels in a header, not the URL, so it can't leak into
    // proxy or error logs that capture request URLs.
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': config.geminiApiKey,
        },
        body: JSON.stringify(body),
        signal,
      },
    )
  } catch (error) {
    clear()
    throw new Error(
      fetchErrorMessage(error, 'Gemini API not reachable (network or CORS error)'),
    )
  }
  if (!response.ok || !response.body) {
    clear()
    throw new Error(`Gemini responded with ${response.status}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      touch()
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const parsed = JSON.parse(line.slice(6)) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[]
          }
          const chunk =
            parsed.candidates?.[0]?.content?.parts
              ?.map((p) => p.text ?? '')
              .join('') ?? ''
          if (chunk !== '') {
            full += chunk
            onChunk(chunk)
          }
        } catch {
          // Skip malformed SSE payloads.
        }
      }
    }
  } catch (error) {
    throw new Error(fetchErrorMessage(error, 'Gemini stream failed'))
  } finally {
    clear()
  }
  return full
}

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
