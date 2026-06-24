/**
 * Ollama-protocol transport (`/api/chat` NDJSON streaming, `/api/tags`
 * model listing). Serves both Ollama itself and LM Studio, which exposes
 * the same endpoints on a different port.
 */
import type { ChatMessage } from '../types'
import type { ProviderSettings } from './types'
import { hostOf, streamLines, trimBaseUrl } from './shared'

/** Extract the text chunk from one NDJSON line of an `/api/chat` stream. */
export function parseOllamaLine(line: string): string {
  if (line.trim() === '') return ''
  try {
    const parsed = JSON.parse(line) as { message?: { content?: string } }
    return parsed.message?.content ?? ''
  } catch {
    // Skip malformed/partial NDJSON lines.
    return ''
  }
}

export async function listOllamaModels(
  baseUrl: string,
  label = 'Ollama',
): Promise<string[]> {
  let response: Response
  try {
    response = await fetch(`${trimBaseUrl(baseUrl)}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    throw new Error(`${label} not reachable at ${hostOf(baseUrl)}`)
  }
  if (!response.ok) {
    throw new Error(`${label} responded with ${response.status}`)
  }
  const data = (await response.json()) as { models?: { name: string }[] }
  return (data.models ?? []).map((m) => m.name)
}

export async function streamOllamaChat(
  label: string,
  settings: ProviderSettings,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  maxTokens?: number,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: settings.model || 'llama3',
    messages,
    stream: true,
  }
  if (maxTokens !== undefined && maxTokens > 0) {
    body.options = { num_predict: maxTokens }
  }
  return streamLines(
    {
      url: `${trimBaseUrl(settings.baseUrl)}/api/chat`,
      headers: { 'content-type': 'application/json' },
      body,
      parseLine: parseOllamaLine,
      errors: {
        unreachable: `${label} not reachable at ${hostOf(settings.baseUrl)}`,
        status: (status) => `${label} responded with ${status}`,
        streamFailed: `${label} stream failed`,
      },
    },
    onChunk,
    signal,
  )
}

/** Connectivity check: the model list endpoint doubles as a cheap ping. */
export async function testOllamaConnection(
  label: string,
  settings: ProviderSettings,
): Promise<string> {
  const models = await listOllamaModels(settings.baseUrl, label)
  return `Connected — ${models.length} model${models.length === 1 ? '' : 's'} available`
}
