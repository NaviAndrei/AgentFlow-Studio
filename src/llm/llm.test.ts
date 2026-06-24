import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROVIDERS, PROVIDER_IDS, defaultProviderSettings, providersInGroup } from './registry'
import { resolveGeminiModelId, parseGeminiLine } from './gemini'
import { parseOllamaLine } from './ollama'
import { parseOpenAICompatLine } from './openaiCompat'
import { streamChat, testConnection } from './index'
import type { ProviderId, ResolvedLLMConfig } from './types'

describe('provider registry', () => {
  it('covers every provider id with a consistent descriptor', () => {
    for (const id of PROVIDER_IDS) {
      const p = PROVIDERS[id]
      expect(p.id).toBe(id)
      if (p.modelInput === 'select') {
        expect(p.modelOptions?.length).toBeGreaterThan(0)
      }
    }
  })

  it('groups providers as LOCAL: ollama+lmstudio, CLOUD: the rest', () => {
    expect(providersInGroup('local').map((p) => p.id)).toEqual([
      'ollama',
      'lmstudio',
    ])
    expect(providersInGroup('cloud').map((p) => p.id)).toEqual([
      'gemini',
      'groq',
      'openrouter',
      'openai',
      'custom',
    ])
  })

  it('routes Groq/OpenRouter/OpenAI/Custom through the shared openai-compat transport', () => {
    for (const id of ['groq', 'openrouter', 'openai', 'custom'] as ProviderId[]) {
      expect(PROVIDERS[id].transport).toBe('openai-compat')
    }
    expect(PROVIDERS.lmstudio.transport).toBe('ollama')
    expect(PROVIDERS.lmstudio.defaults.baseUrl).toBe('http://localhost:1234')
    expect(PROVIDERS.gemini.transport).toBe('gemini')
  })

  it('seeds default settings as independent copies', () => {
    const a = defaultProviderSettings()
    a.ollama.model = 'mutated'
    expect(PROVIDERS.ollama.defaults.model).toBe('')
    expect(defaultProviderSettings().ollama.model).toBe('')
  })
})

describe('stream line parsers', () => {
  it('parses Ollama NDJSON lines and skips malformed ones', () => {
    expect(parseOllamaLine('{"message":{"content":"hi"}}')).toBe('hi')
    expect(parseOllamaLine('')).toBe('')
    expect(parseOllamaLine('{broken')).toBe('')
  })

  it('parses Gemini SSE lines', () => {
    const line =
      'data: {"candidates":[{"content":{"parts":[{"text":"a"},{"text":"b"}]}}]}'
    expect(parseGeminiLine(line)).toBe('ab')
    expect(parseGeminiLine('event: ping')).toBe('')
  })

  it('parses OpenAI-compatible SSE lines including [DONE]', () => {
    expect(
      parseOpenAICompatLine('data: {"choices":[{"delta":{"content":"x"}}]}'),
    ).toBe('x')
    expect(parseOpenAICompatLine('data: [DONE]')).toBe('')
    expect(
      parseOpenAICompatLine('data: {"choices":[{"delta":{"content":null}}]}'),
    ).toBe('')
  })

  it('maps Gemini tiers to concrete ids and passes overrides through', () => {
    expect(resolveGeminiModelId('gemini-flash')).toBe('gemini-2.5-flash')
    expect(resolveGeminiModelId('gemini-2.0-flash')).toBe('gemini-2.0-flash')
  })
})

function config(
  provider: ProviderId,
  patch: Partial<ResolvedLLMConfig['settings']> = {},
): ResolvedLLMConfig {
  return { provider, settings: { ...PROVIDERS[provider].defaults, ...patch } }
}

function sseResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines.join('\n') + '\n'))
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

describe('streamChat dispatch', () => {
  beforeEach(() => {
    // The test window stub fires setTimeout callbacks immediately, which
    // would trip the stream idle watchdog; make timers inert instead.
    vi.stubGlobal('window', {
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects cloud providers with no API key before any network call', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    for (const id of ['gemini', 'groq', 'openrouter', 'openai'] as ProviderId[]) {
      await expect(
        streamChat(config(id), [{ role: 'user', content: 'hi' }], () => {}),
      ).rejects.toThrow(`${PROVIDERS[id].label} API key is not set`)
      await expect(testConnection(config(id))).rejects.toThrow(
        'API key is not set',
      )
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects a custom provider with no base URL', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(
      streamChat(config('custom', { model: 'm' }), [], () => {}),
    ).rejects.toThrow('Custom URL base URL is not set')
  })

  it('streams an OpenAI-compatible response with bearer auth', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}',
        'data: {"choices":[{"delta":{"content":"lo"}}]}',
        'data: [DONE]',
      ]),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const chunks: string[] = []
    const full = await streamChat(
      config('groq', { apiKey: 'gsk_test' }),
      [{ role: 'user', content: 'hi' }],
      (c) => chunks.push(c),
    )
    expect(full).toBe('Hello')
    expect(chunks).toEqual(['Hel', 'lo'])
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer gsk_test',
    )
    const body = JSON.parse(init.body as string) as { model: string; stream: boolean }
    expect(body.model).toBe('llama-3.3-70b-versatile')
    expect(body.stream).toBe(true)
  })

  it('omits the auth header for an unauthenticated custom endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(sseResponse(['data: [DONE]']))
    vi.stubGlobal('fetch', fetchSpy)
    await streamChat(
      config('custom', { baseUrl: 'http://localhost:8080/v1', model: 'm' }),
      [{ role: 'user', content: 'hi' }],
      () => {},
    )
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8080/v1/chat/completions')
    expect(
      (init.headers as Record<string, string>).authorization,
    ).toBeUndefined()
  })

  it('streams LM Studio through the Ollama NDJSON path', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      sseResponse(['{"message":{"content":"ok"}}']),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const full = await streamChat(
      config('lmstudio', { model: 'qwen' }),
      [{ role: 'user', content: 'hi' }],
      () => {},
    )
    expect(full).toBe('ok')
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:1234/api/chat')
  })

  it('surfaces cancellation as a readable error', async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValue(new DOMException('aborted', 'AbortError'))
    vi.stubGlobal('fetch', fetchSpy)
    const controller = new AbortController()
    controller.abort()
    await expect(
      streamChat(
        config('openai', { apiKey: 'sk-test' }),
        [{ role: 'user', content: 'hi' }],
        () => {},
        controller.signal,
      ),
    ).rejects.toThrow('Request cancelled')
  })

  it('reports HTTP failures with the provider label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 401 })),
    )
    await expect(
      streamChat(
        config('openrouter', { apiKey: 'bad' }),
        [{ role: 'user', content: 'hi' }],
        () => {},
      ),
    ).rejects.toThrow('OpenRouter rejected the API key (HTTP 401)')
  })

  it('streams an OpenAI response to the chat-completions endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}',
        'data: {"choices":[{"delta":{"content":" there"}}]}',
        'data: [DONE]',
      ]),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const full = await streamChat(
      config('openai', { apiKey: 'sk-test' }),
      [{ role: 'user', content: 'hi' }],
      () => {},
    )
    expect(full).toBe('Hi there')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer sk-test',
    )
    const body = JSON.parse(init.body as string) as { model: string }
    expect(body.model).toBe('gpt-4o-mini')
  })

  it('streams a Gemini response with the key in a header, not the URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}',
        'data: {"candidates":[{"content":{"parts":[{"text":"lo"}]}}]}',
      ]),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const full = await streamChat(
      config('gemini', { apiKey: 'AIza-test' }),
      [{ role: 'user', content: 'hi' }],
      () => {},
    )
    expect(full).toBe('Hello')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
    )
    // Key travels in the header so it can't leak into request-URL logs.
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'AIza-test',
    )
    expect(url).not.toContain('AIza-test')
  })

  it('surfaces a 429 as a readable rate-limit error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('slow down', { status: 429 })),
    )
    await expect(
      streamChat(
        config('openai', { apiKey: 'sk-test' }),
        [{ role: 'user', content: 'hi' }],
        () => {},
      ),
    ).rejects.toThrow('OpenAI rate limit exceeded (HTTP 429)')
  })

  it('tests OpenAI-compatible connections via GET /models', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'a' }, { id: 'b' }] }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    await expect(
      testConnection(config('openai', { apiKey: 'sk-test' })),
    ).resolves.toBe('Connected — 2 models available')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/models')
    expect(init.method).toBeUndefined()
  })
})
