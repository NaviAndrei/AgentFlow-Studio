import { useLLMConfigStore } from '../store/llmConfigStore'
import { streamChat } from '../llm'
import { estimateTokens } from './fakeData'
import type { ChatMessage } from '../types'

export interface LLMDirectResult {
  text: string
  tokensUsed?: number
  error?: string
}

/**
 * One-shot, non-streaming LLM call for opt-in copilot features (prompt suggest,
 * NL flow builder). Reuses the project's transport abstraction (getConfig +
 * streamChat) rather than re-implementing a raw fetch, so all configured
 * providers work and the active global model/provider is honoured. Never
 * throws — failures resolve as `{ text: '', error }`.
 */
export async function callLLMDirect(
  systemPrompt: string,
  userMessage: string,
): Promise<LLMDirectResult> {
  const base = useLLMConfigStore.getState().getConfig()
  const config = { ...base, maxTokens: 1024 }
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ]
  if (userMessage) messages.push({ role: 'user', content: userMessage })

  try {
    const text = await streamChat(config, messages, () => {})
    return { text, tokensUsed: estimateTokens(text) }
  } catch (error) {
    const statusText =
      error instanceof Error ? error.message : 'unknown error'
    return { text: '', error: 'LLM call failed: ' + statusText }
  }
}
