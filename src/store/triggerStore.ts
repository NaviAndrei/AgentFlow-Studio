import { create } from 'zustand'
import { useSimulationStore } from './simulationStore'

interface TriggerState {
  /** nodeId -> interval id, for armed schedule triggers. */
  activeTriggers: Record<string, ReturnType<typeof setInterval>>
  armWebhook: (nodeId: string) => string
  armSchedule: (nodeId: string, intervalMs: number) => void
  disarm: (nodeId: string) => void
  disarmAll: () => void
  /** Injects a payload as the run's input and starts the flow. */
  simulateWebhookFire: (nodeId: string, payload: unknown) => void
}

export const useTriggerStore = create<TriggerState>((set, get) => ({
  activeTriggers: {},

  armWebhook: (nodeId) => {
    const webhookId = crypto.randomUUID()
    get().disarm(nodeId)
    // Placeholder timer marks the webhook as armed; it never fires — firing
    // happens explicitly via simulateWebhookFire (the mock "Fire Now" button).
    const intervalId = setInterval(() => {}, 2_147_483_647)
    set({ activeTriggers: { ...get().activeTriggers, [nodeId]: intervalId } })
    return webhookId
  },

  armSchedule: (nodeId, intervalMs) => {
    get().disarm(nodeId)
    const intervalId = setInterval(() => {
      get().simulateWebhookFire(nodeId, {})
    }, intervalMs)
    set({ activeTriggers: { ...get().activeTriggers, [nodeId]: intervalId } })
  },

  disarm: (nodeId) => {
    const existing = get().activeTriggers[nodeId]
    if (existing !== undefined) clearInterval(existing)
    const next = { ...get().activeTriggers }
    delete next[nodeId]
    set({ activeTriggers: next })
  },

  disarmAll: () => {
    for (const id of Object.values(get().activeTriggers)) clearInterval(id)
    set({ activeTriggers: {} })
  },

  simulateWebhookFire: (_nodeId, payload) => {
    useSimulationStore.getState().setUserInput(JSON.stringify(payload))
    useSimulationStore.getState().start()
  },
}))
