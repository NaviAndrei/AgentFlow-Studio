import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from './uiStore'

beforeEach(() => {
  useUIStore.setState({ minimapVisible: true })
})

describe('uiStore — minimap toggle', () => {
  it('starts visible and flips on each call', () => {
    expect(useUIStore.getState().minimapVisible).toBe(true)
    useUIStore.getState().toggleMinimap()
    expect(useUIStore.getState().minimapVisible).toBe(false)
    useUIStore.getState().toggleMinimap()
    expect(useUIStore.getState().minimapVisible).toBe(true)
  })
})

describe('uiStore — animated edges toggle', () => {
  it('starts disabled and flips on each call', () => {
    useUIStore.setState({ animatedEdgesEnabled: false })
    expect(useUIStore.getState().animatedEdgesEnabled).toBe(false)
    useUIStore.getState().toggleAnimatedEdges()
    expect(useUIStore.getState().animatedEdgesEnabled).toBe(true)
    useUIStore.getState().toggleAnimatedEdges()
    expect(useUIStore.getState().animatedEdgesEnabled).toBe(false)
  })
})
