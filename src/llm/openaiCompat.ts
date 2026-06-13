/**
 * OpenAI-compatible transport — the de-facto standard `/chat/completions`
 * SSE format. One implementation covers Groq, OpenRouter, OpenAI, and any
 * custom endpoint that speaks the same protocol.
 */
import type { ChatMessage } from '../types'
import type { ProviderSettings } from './types'
import { fetchErrorMessage, hostOf, streamLines, trimBaseUrl } from './shared'

/** Extract the text chunk from one `data:` line of a chat-completions SSE stream. */
export function parseOpenAICompatLine(line: string): string {
  if (!line.startsWith('data:')) return ''
  const payload = line.slice(5).trim()
  if (payload === '' || payload === '[DONE]') return ''
  try {
    const parsed = JSON.parse(payload) as {
      choices?: { delta?: { content?: string | null } }[]
    }
    return parsed.choices?.[0]?.delta?.content ?? ''
  } catch {
    // Skip malformed SSE payloads.
    return ''
  }
}

function authHeaders(settings: ProviderSettings): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  // Custom endpoints may be unauthenticated; only attach the header when set.
  if (settings.apiKey.trim() !== '') {
    headers.authorization = `Bearer ${settings.apiKey}`
  }
  return headers
}

function requireBaseUrl(label: string, settings: ProviderSettings): void {
  if (settings.baseUrl.trim() === '') {
    throw new Error(`${label} base URL is not set`)
  }
}

export async function streamOpenAICompatChat(
  label: string,
  settings: ProviderSettings,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  requireBaseUrl(label, settings)
  if (settings.model.trim() === '') {
    throw new Error(`${label} model is not set`)
  }
  return streamLines(
    {
      url: `${trimBaseUrl(settings.baseUrl)}/chat/completions`,
      headers: authHeaders(settings),
      body: {
        model: settings.model,
        messages,
        stream: true,
      },
      parseLine: parseOpenAICompatLine,
      errors: {
        unreachable: `${label} not reachable at ${hostOf(settings.baseUrl)}`,
        status: (status) =>
          status === 401 || status === 403
            ? `${label} rejected the API key (HTTP ${status})`
            : `${label} responded with ${status}`,
        streamFailed: `${label} stream failed`,
      },
    },
    onChunk,
    signal,
  )
}

/**
 * Connectivity check via `GET /models`, which every OpenAI-compatible
 * provider serves and which validates the key without spending tokens.
 */
export async function testOpenAICompatConnection(
  label: string,
  settings: ProviderSettings,
): Promise<string> {
  requireBaseUrl(label, settings)
  let response: Response
  try {
    response = await fetch(`${trimBaseUrl(settings.baseUrl)}/models`, {
      headers: authHeaders(settings),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new Error(
      fetchErrorMessage(
        error,
        `${label} not reachable at ${hostOf(settings.baseUrl)}`,
      ),
    )
  }
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? `${label} rejected the API key (HTTP ${response.status})`
        : `${label} responded with ${response.status}`,
    )
  }
  const data = (await response.json()) as { data?: unknown[] }
  const count = Array.isArray(data.data) ? data.data.length : null
  return count === null
    ? 'Connected'
    : `Connected — ${count} model${count === 1 ? '' : 's'} available`
}
