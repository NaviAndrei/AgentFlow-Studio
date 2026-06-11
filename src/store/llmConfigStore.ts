import { create } from 'zustand'
import { listOllamaModels } from '../utils/llmClient'
import type { GeminiModel, LLMConfig, LLMProvider } from '../utils/llmClient'

interface LLMConfigState {
  provider: LLMProvider
  ollamaUrl: string
  ollamaModel: string
  ollamaModels: string[]
  geminiApiKey: string
  geminiModel: GeminiModel
  settingsOpen: boolean
  /** Transient error surfaced as a tooltip near the Live toggle. */
  liveError: string | null
  setProvider: (provider: LLMProvider) => void
  setOllamaUrl: (url: string) => void
  setOllamaModel: (model: string) => void
  setGeminiApiKey: (key: string) => void
  setGeminiModel: (model: GeminiModel) => void
  setSettingsOpen: (open: boolean) => void
  setLiveError: (error: string | null) => void
  refreshOllamaModels: () => Promise<void>
  getConfig: () => LLMConfig
}

export const useLLMConfigStore = create<LLMConfigState>((set, get) => ({
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: '',
  ollamaModels: [],
  geminiApiKey: '',
  geminiModel: 'gemini-flash',
  settingsOpen: false,
  liveError: null,

  setProvider: (provider) => set({ provider }),
  setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
  setOllamaModel: (ollamaModel) => set({ ollamaModel }),
  setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
  setGeminiModel: (geminiModel) => set({ geminiModel }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setLiveError: (liveError) => set({ liveError }),

  refreshOllamaModels: async () => {
    const ollamaModels = await listOllamaModels(get().ollamaUrl)
    set({ ollamaModels })
    if (!get().ollamaModel && ollamaModels.length > 0) {
      set({ ollamaModel: ollamaModels[0] })
    }
  },

  getConfig: () => {
    const { provider, ollamaUrl, ollamaModel, geminiApiKey, geminiModel } =
      get()
    return { provider, ollamaUrl, ollamaModel, geminiApiKey, geminiModel }
  },
}))
