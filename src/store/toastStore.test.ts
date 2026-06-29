import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { useToastStore } from './toastStore'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('toastStore', () => {
  it('adds a toast message to the state on pushToast', () => {
    const store = useToastStore.getState()
    expect(store.toasts).toHaveLength(0)

    useToastStore.getState().pushToast('Hello world')

    const updatedStore = useToastStore.getState()
    expect(updatedStore.toasts).toHaveLength(1)
    expect(updatedStore.toasts[0].text).toBe('Hello world')
    expect(updatedStore.toasts[0].tone).toBe('info')
    expect(updatedStore.toasts[0].id).toBeDefined()
  })

  it('supports custom tone (warning)', () => {
    useToastStore.getState().pushToast('Danger ahead', 'warning')

    const store = useToastStore.getState()
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0].text).toBe('Danger ahead')
    expect(store.toasts[0].tone).toBe('warning')
  })

  it('removes a toast manually on dismissToast', () => {
    useToastStore.getState().pushToast('Dismiss me')
    let store = useToastStore.getState()
    expect(store.toasts).toHaveLength(1)

    const id = store.toasts[0].id
    useToastStore.getState().dismissToast(id)

    store = useToastStore.getState()
    expect(store.toasts).toHaveLength(0)
  })

  it('automatically dismisses a toast after 3000ms', () => {
    useToastStore.getState().pushToast('Auto dismiss test')
    let store = useToastStore.getState()
    expect(store.toasts).toHaveLength(1)

    // Advance timers by less than AUTO_DISMISS_MS (e.g. 2900ms)
    vi.advanceTimersByTime(2900)
    store = useToastStore.getState()
    expect(store.toasts).toHaveLength(1)

    // Advance past AUTO_DISMISS_MS (3000ms total)
    vi.advanceTimersByTime(100)
    store = useToastStore.getState()
    expect(store.toasts).toHaveLength(0)
  })
})
