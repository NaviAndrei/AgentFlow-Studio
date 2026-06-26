import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MCPServerConfig } from '../types'
import { useToastStore } from './toastStore'

interface MCPState {
  servers: Record<string, MCPServerConfig>
  addServer(config: MCPServerConfig): void
  removeServer(serverKey: string): void
  updateServer(serverKey: string, patch: Partial<MCPServerConfig>): void
  testConnection(serverKey: string): Promise<void>
}

export const useMCPStore = create<MCPState>()(
  persist(
    (set, get) => ({
      servers: {},

      addServer(config) {
        set((s) => ({
          servers: { ...s.servers, [config.serverKey]: config },
        }))
      },

      removeServer(serverKey) {
        set((s) => {
          const next = { ...s.servers }
          delete next[serverKey]
          return { servers: next }
        })
      },

      updateServer(serverKey, patch) {
        set((s) => {
          const existing = s.servers[serverKey]
          if (!existing) return s
          return { servers: { ...s.servers, [serverKey]: { ...existing, ...patch } } }
        })
      },

      async testConnection(serverKey) {
        const server = get().servers[serverKey]
        if (!server) return
        const controller = new AbortController()
        const timer = window.setTimeout(() => controller.abort(), 3000)
        try {
          const headers: Record<string, string> = {}
          if (server.authToken) headers['Authorization'] = `Bearer ${server.authToken}`
          await fetch(`${server.endpointUrl}/health`, { signal: controller.signal, headers })
          clearTimeout(timer)
          get().updateServer(serverKey, { isConnected: true })
          useToastStore.getState().pushToast(`${server.label}: connected`, 'info')
        } catch {
          clearTimeout(timer)
          get().updateServer(serverKey, { isConnected: false })
          useToastStore.getState().pushToast(`${server.label}: connection failed`, 'warning')
        }
      },
    }),
    {
      name: 'agentflow-mcp-servers',
      // Strip authToken and runtime-only isConnected before persisting
      partialize: (state) => ({
        servers: Object.fromEntries(
          Object.entries(state.servers).map(([key, cfg]) => [
            key,
            { ...cfg, authToken: undefined, isConnected: undefined },
          ]),
        ),
      }),
    },
  ),
)
