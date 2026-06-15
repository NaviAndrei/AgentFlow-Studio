import { usePromptStore } from '../store/promptStore'
import type { AgentFlowNodeData } from '../types'

/**
 * Resolve a node's effective system prompt: if `systemPromptRef` points at a
 * Prompt Registry entry, its active version wins; otherwise falls back to the
 * inline `systemPrompt` (or '' if neither is set).
 */
export function resolveNodePrompts(data: AgentFlowNodeData): {
  systemPrompt: string
} {
  const { getActiveContent } = usePromptStore.getState()
  const systemPrompt = data.systemPromptRef
    ? (getActiveContent(data.systemPromptRef) ?? data.systemPrompt ?? '')
    : (data.systemPrompt ?? '')
  return { systemPrompt }
}
