import type { AgentFlowNode } from '../types'

/**
 * Build the system prompt that asks an LLM to improve a node's system prompt.
 * Output is fed to callLLMDirect as the system message (user message empty).
 */
export function buildSuggestionPrompt(
  node: AgentFlowNode,
  connectedNodeLabels: string[],
): string {
  const currentPrompt = node.data.systemPrompt ?? ''
  const label = node.data.label ?? 'Unnamed'
  const upstream =
    connectedNodeLabels.length > 0 ? connectedNodeLabels.join(', ') : 'none'
  return `You are a prompt engineering expert for AI agent workflows.
Node type: ${node.type}
Node label: ${label}
Current system prompt: "${currentPrompt}"
Connected upstream nodes: ${upstream}
Blueprint context: AgentFlow Studio visual workflow builder

Write an improved system prompt for this node. Be specific to its role in the flow.
Output ONLY the system prompt text — no explanation, no quotes, no markdown.`
}
