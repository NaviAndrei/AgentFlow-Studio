/**
 * Gemini transport — Google's generateContent API, which has its own
 * request shape (contents/parts, systemInstruction) and SSE stream format.
 */
import type { ChatMessage } from '../types'
import type { ProviderSettings } from './types'
import { fetchErrorMessage, streamLines } from './shared'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// "flash"/"pro" are capability tiers; map to the current concrete Gemini
// model ids (2.5 GA line). Anything else is passed through as a literal
// model id, so per-node overrides can target e.g. "gemini-2.0-flash".
const GEMINI_MODEL_IDS: Record<string, string> = {
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-pro',
}

export const GEMINI_MODEL_TIERS = Object.keys(GEMINI_MODEL_IDS)

export function resolveGeminiModelId(model: string): string {
  return GEMINI_MODEL_IDS[model] ?? model
}

/** Extract the text chunk from one `data:` line of a Gemini SSE stream. */
export function parseGeminiLine(line: string): string {
  if (!line.startsWith('data: ')) return ''
  try {
    const parsed = JSON.parse(line.slice(6)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    return (
      parsed.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('') ?? ''
    )
  } catch {
    // Skip malformed SSE payloads.
    return ''
  }
}

function requireKey(settings: ProviderSettings): void {
  if (settings.apiKey.trim() === '') {
    throw new Error('Gemini API key is not set')
  }
}

export async function streamGeminiChat(
  settings: ProviderSettings,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  requireKey(settings)
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
  const modelId = resolveGeminiModelId(settings.model)
  // API key travels in a header, not the URL, so it can't leak into
  // proxy or error logs that capture request URLs.
  return streamLines(
    {
      url: `${GEMINI_BASE}/models/${modelId}:streamGenerateContent?alt=sse`,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': settings.apiKey,
      },
      body,
      parseLine: parseGeminiLine,
      errors: {
        unreachable: 'Gemini API not reachable (network or CORS error)',
        status: (status) => `Gemini responded with ${status}`,
        streamFailed: 'Gemini stream failed',
      },
    },
    onChunk,
    signal,
  )
}

/**
 * Lightweight connectivity check for the Gemini key/model: a 1-output-token
 * generateContent call. Resolves on success, rejects with a readable Error.
 */
export async function testGeminiConnection(
  settings: ProviderSettings,
): Promise<string> {
  requireKey(settings)
  const modelId = resolveGeminiModelId(settings.model)
  let response: Response
  try {
    response = await fetch(`${GEMINI_BASE}/models/${modelId}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': settings.apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
      signal: AbortSignal.timeout(10_000),
    })
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
  return 'Connected — key and model accepted'
}
