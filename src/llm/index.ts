/**
 * Public surface of the LLM layer. Callers hold a ResolvedLLMConfig and use
 * streamChat / testConnection; dispatch to the right transport happens here,
 * keyed by the provider descriptor's `transport` field.
 */
import type { ChatMessage } from '../types'
import type { ResolvedLLMConfig } from './types'
import { PROVIDERS } from './registry'
import { streamGeminiChat, testGeminiConnection } from './gemini'
import { streamOllamaChat, testOllamaConnection } from './ollama'
import {
  streamOpenAICompatChat,
  testOpenAICompatConnection,
} from './openaiCompat'

export type {
  ModelInputKind,
  ProviderDescriptor,
  ProviderGroup,
  ProviderId,
  ProviderSettings,
  ResolvedLLMConfig,
  TransportId,
} from './types'
export {
  PROVIDERS,
  PROVIDER_IDS,
  defaultProviderSettings,
  providersInGroup,
} from './registry'
export { isInsecureRemoteUrl } from './shared'
export { listOllamaModels } from './ollama'

function requireApiKey(config: ResolvedLLMConfig): void {
  const descriptor = PROVIDERS[config.provider]
  if (descriptor.apiKey === 'required' && config.settings.apiKey.trim() === '') {
    throw new Error(`${descriptor.label} API key is not set`)
  }
}

/** Stream a chat completion; resolves with the full response text. */
export async function streamChat(
  config: ResolvedLLMConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const descriptor = PROVIDERS[config.provider]
  requireApiKey(config)
  switch (descriptor.transport) {
    case 'ollama':
      return streamOllamaChat(
        descriptor.label,
        config.settings,
        messages,
        onChunk,
        signal,
        config.maxTokens,
      )
    case 'gemini':
      return streamGeminiChat(
        config.settings,
        messages,
        onChunk,
        signal,
        config.maxTokens,
      )
    case 'openai-compat':
      return streamOpenAICompatChat(
        descriptor.label,
        config.settings,
        messages,
        onChunk,
        signal,
        config.maxTokens,
      )
  }
}

/**
 * Per-provider connectivity check; resolves with a human-readable success
 * message, rejects with a readable Error.
 */
export async function testConnection(
  config: ResolvedLLMConfig,
): Promise<string> {
  const descriptor = PROVIDERS[config.provider]
  requireApiKey(config)
  switch (descriptor.transport) {
    case 'ollama':
      return testOllamaConnection(descriptor.label, config.settings)
    case 'gemini':
      return testGeminiConnection(config.settings)
    case 'openai-compat':
      return testOpenAICompatConnection(descriptor.label, config.settings)
  }
}
