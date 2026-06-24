import type { ChatMessage } from '../types'

/** Every connectable provider. Adding one = new entry here + a registry descriptor. */
export type ProviderId =
  | 'ollama'
  | 'lmstudio'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'openai'
  | 'custom'

export type ProviderGroup = 'local' | 'cloud'

/**
 * Wire protocol a provider speaks. Several providers share one transport:
 * LM Studio rides the Ollama path; Groq/OpenRouter/OpenAI/Custom all speak
 * the OpenAI `/chat/completions` format.
 */
export type TransportId = 'ollama' | 'gemini' | 'openai-compat'

/** How the modal renders the model field for a provider. */
export type ModelInputKind = 'dynamic' | 'text' | 'select'

/** Per-provider connection settings, kept in memory only. */
export interface ProviderSettings {
  baseUrl: string
  apiKey: string
  model: string
}

/** Everything a transport needs to run one call. */
export interface ResolvedLLMConfig {
  provider: ProviderId
  settings: ProviderSettings
  /** Per-call output token cap; omitted = provider default. */
  maxTokens?: number
}

/** Static, declarative description of a provider; drives the modal UI and dispatch. */
export interface ProviderDescriptor {
  id: ProviderId
  label: string
  group: ProviderGroup
  transport: TransportId
  defaults: ProviderSettings
  apiKey: 'required' | 'optional' | 'none'
  baseUrlEditable: boolean
  modelInput: ModelInputKind
  /** Choices when modelInput is 'select'. */
  modelOptions?: readonly string[]
  modelPlaceholder?: string
  keyPlaceholder?: string
}

export type StreamFn = (
  config: ResolvedLLMConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
) => Promise<string>

/** Connectivity check; resolves with a human-readable success message. */
export type TestFn = (config: ResolvedLLMConfig) => Promise<string>
