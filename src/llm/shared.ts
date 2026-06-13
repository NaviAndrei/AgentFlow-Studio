/**
 * Plumbing shared by every transport: URL helpers, readable fetch errors,
 * the stream idle watchdog, and the line-oriented stream pump that all
 * three wire formats (NDJSON, Gemini SSE, OpenAI SSE) are parsed from.
 */

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Strip trailing slashes so paths can be appended safely. */
export function trimBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
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
export function fetchErrorMessage(error: unknown, fallback: string): string {
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

export interface StreamRequest {
  url: string
  headers: Record<string, string>
  body: unknown
  /**
   * Extract the text chunk carried by one stream line ('' when the line
   * carries none). Pure, so each wire format is unit-testable in isolation.
   */
  parseLine: (line: string) => string
  /** Human-readable error messages, named per provider. */
  errors: {
    unreachable: string
    /** Built from the HTTP status of a non-OK response. */
    status: (status: number) => string
    streamFailed: string
  }
}

/**
 * POST a streaming request and pump its body line by line through
 * `parseLine`, forwarding non-empty chunks to `onChunk`. Handles chunk
 * buffering, the idle watchdog, and error translation for every transport.
 * Resolves with the concatenated response text.
 */
export async function streamLines(
  request: StreamRequest,
  onChunk: (text: string) => void,
  callerSignal?: AbortSignal,
): Promise<string> {
  const { signal, touch, clear } = withIdleTimeout(callerSignal)
  let response: Response
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal,
    })
  } catch (error) {
    clear()
    throw new Error(fetchErrorMessage(error, request.errors.unreachable))
  }
  if (!response.ok || !response.body) {
    clear()
    throw new Error(request.errors.status(response.status))
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
        const chunk = request.parseLine(line)
        if (chunk !== '') {
          full += chunk
          onChunk(chunk)
        }
      }
    }
  } catch (error) {
    throw new Error(fetchErrorMessage(error, request.errors.streamFailed))
  } finally {
    clear()
  }
  return full
}
