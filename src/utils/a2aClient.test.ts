import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAgentCard, sendA2ATask, pollA2ATask } from './a2aClient'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  } as Response)
}

describe('a2aClient', () => {
  it('fetchAgentCard returns a card on valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({
        name: 'Researcher',
        skills: [{ id: 's1', name: 'search' }],
      }),
    )
    const card = await fetchAgentCard('http://agent.test')
    expect(card?.name).toBe('Researcher')
    expect(card?.skills).toHaveLength(1)
  })

  it('fetchAgentCard returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const card = await fetchAgentCard('http://agent.test')
    expect(card).toBeNull()
  })

  it('sendA2ATask returns a non-empty taskId', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ result: { id: 'task-123' } }))
    const result = await sendA2ATask('http://agent.test', 'do work')
    expect(result.error).toBeUndefined()
    expect(result.taskId).toBe('task-123')
  })

  it('pollA2ATask returns output and calls onStatusUpdate per poll', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { status: { state: 'working' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            status: { state: 'completed' },
            artifacts: [{ parts: [{ text: 'final answer' }] }],
          },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)
    const onStatus = vi.fn()
    const result = await pollA2ATask(
      'http://agent.test',
      'task-123',
      { pollIntervalMs: 1, maxPollAttempts: 5 },
      onStatus,
    )
    expect(result.status).toBe('completed')
    expect(result.output).toBe('final answer')
    expect(onStatus).toHaveBeenCalledTimes(2)
  })
})
