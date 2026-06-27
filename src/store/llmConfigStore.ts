import { create } from 'zustand'
import { defaultProviderSettings, listOllamaModels } from '../llm'
import type { ProviderId, ProviderSettings, ResolvedLLMConfig } from '../llm'

/** Hard caps on a simulation run's spend; either field may be left unset. */
export interface BudgetConfig {
  maxUSD?: number
  maxTokens?: number
}

interface LLMConfigState {
  activeProvider: ProviderId
  /** Per-provider connection settings; edits to one provider never touch another. */
  settings: Record<ProviderId, ProviderSettings>
  /** Models discovered from the Ollama `/api/tags` endpoint. */
  ollamaModels: string[]
  settingsOpen: boolean
  /** Transient error surfaced as a tooltip near the Live toggle. */
  liveError: string | null
  budgetConfig: BudgetConfig
  setActiveProvider: (provider: ProviderId) => void
  updateProviderSettings: (
    provider: ProviderId,
    patch: Partial<ProviderSettings>,
  ) => void
  setSettingsOpen: (open: boolean) => void
  setLiveError: (error: string | null) => void
  refreshOllamaModels: () => Promise<void>
  getConfig: () => ResolvedLLMConfig
  setBudgetConfig: (budget: BudgetConfig) => void
}

export const useLLMConfigStore = create<LLMConfigState>((set, get) => ({
  activeProvider: 'ollama',
  settings: defaultProviderSettings(),
  ollamaModels: [],
  settingsOpen: false,
  liveError: null,
  budgetConfig: {},

  setActiveProvider: (activeProvider) => set({ activeProvider }),

  setBudgetConfig: (budgetConfig) => set({ budgetConfig }),

  updateProviderSettings: (provider, patch) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [provider]: { ...state.settings[provider], ...patch },
      },
    })),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setLiveError: (liveError) => set({ liveError }),

  refreshOllamaModels: async () => {
    const ollamaModels = await listOllamaModels(get().settings.ollama.baseUrl)
    set({ ollamaModels })
    if (!get().settings.ollama.model && ollamaModels.length > 0) {
      get().updateProviderSettings('ollama', { model: ollamaModels[0] })
    }
  },

  getConfig: () => {
    const { activeProvider, settings } = get()
    return { provider: activeProvider, settings: { ...settings[activeProvider] } }
  },
}))
