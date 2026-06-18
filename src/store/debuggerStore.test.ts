// T2-2: unit tests for the Time-Travel Debugger playback store.
import { beforeEach, describe, expect, it } from 'vitest'
import { useDebuggerStore } from './debuggerStore'

beforeEach(() => {
  useDebuggerStore.getState().reset()
  useDebuggerStore.setState({ dockTab: 'trace', showDiff: false, playbackSpeed: 1 })
})

describe('debuggerStore', () => {
  it('focuses a step and its node', () => {
    useDebuggerStore.getState().setActiveStep(2, 'node-x')
    const s = useDebuggerStore.getState()
    expect(s.activeStepIndex).toBe(2)
    expect(s.activeStepNodeId).toBe('node-x')
  })

  it('toggles play / pause', () => {
    useDebuggerStore.getState().play()
    expect(useDebuggerStore.getState().isPlaying).toBe(true)
    useDebuggerStore.getState().pause()
    expect(useDebuggerStore.getState().isPlaying).toBe(false)
  })

  it('sets playback speed and dock tab', () => {
    useDebuggerStore.getState().setSpeed(4)
    useDebuggerStore.getState().setDockTab('timeTravel')
    const s = useDebuggerStore.getState()
    expect(s.playbackSpeed).toBe(4)
    expect(s.dockTab).toBe('timeTravel')
  })

  it('toggles the diff flag', () => {
    expect(useDebuggerStore.getState().showDiff).toBe(false)
    useDebuggerStore.getState().toggleDiff()
    expect(useDebuggerStore.getState().showDiff).toBe(true)
  })

  it('reset returns to step 0, stops playback and clears the highlight', () => {
    useDebuggerStore.getState().setActiveStep(3, 'n')
    useDebuggerStore.getState().play()
    useDebuggerStore.getState().reset()
    const s = useDebuggerStore.getState()
    expect(s.activeStepIndex).toBe(0)
    expect(s.isPlaying).toBe(false)
    expect(s.activeStepNodeId).toBeNull()
  })
})
