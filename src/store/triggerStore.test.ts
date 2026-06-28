import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTriggerStore } from './triggerStore'
import { useSimulationStore } from './simulationStore'

beforeEach(() => {
  useTriggerStore.getState().disarmAll()
})

describe('triggerStore', () => {
  it('armWebhook returns a non-empty UUID and registers the node as active', () => {
    const id = useTriggerStore.getState().armWebhook('node-1')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(useTriggerStore.getState().activeTriggers['node-1']).toBeDefined()
  })

  it('disarm removes the nodeId from activeTriggers', () => {
    useTriggerStore.getState().armWebhook('node-1')
    useTriggerStore.getState().disarm('node-1')
    expect(useTriggerStore.getState().activeTriggers['node-1']).toBeUndefined()
  })

  it('simulateWebhookFire sets the run input and starts the simulation', () => {
    const setUserInput = vi.spyOn(useSimulationStore.getState(), 'setUserInput')
    const start = vi.spyOn(useSimulationStore.getState(), 'start')

    useTriggerStore.getState().simulateWebhookFire('node-1', { foo: 'bar' })

    expect(setUserInput).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }))
    expect(start).toHaveBeenCalled()
  })
})
