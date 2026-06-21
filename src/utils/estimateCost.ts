import type { AgentFlowNode } from '../types'
import { getPricing } from '../data/modelPricing'

/** Node types that invoke an LLM and therefore carry a real per-call cost. */
export const COSTED_NODE_TYPES = new Set([
  'llm',
  'agent',
  'router',
  'guardrail',
  'evaluator',
  'supervisor',
  'swarmWorker',
])

/** Rough per-call token budget for a pre-run estimate (no real content exists yet). */
const AVG_INPUT_TOKENS = 800
const AVG_OUTPUT_TOKENS = 400

export interface PreRunCostEstimate {
  /** Number of nodes on the canvas that will invoke an LLM. */
  count: number
  estimatedCostUsd: number
}

/**
 * Rough pre-run cost estimate: counts LLM-invoking nodes and prices each at a
 * fixed average token budget using its resolved model (per-node override,
 * else the node's own model field, else the global provider model).
 */
export function estimatePreRunCost(
  nodes: AgentFlowNode[],
  globalModel: string,
): PreRunCostEstimate {
  let count = 0
  let estimatedCostUsd = 0
  for (const node of nodes) {
    if (!node.type || !COSTED_NODE_TYPES.has(node.type)) continue
    count++
    const model =
      (node.data.modelOverride && node.data.modelOverride.trim() !== ''
        ? node.data.modelOverride
        : undefined) ??
      (node.data.model && node.data.model.trim() !== '' ? node.data.model : undefined) ??
      globalModel
    const pricing = getPricing(model)
    estimatedCostUsd +=
      (AVG_INPUT_TOKENS / 1_000_000) * pricing.inputPer1M +
      (AVG_OUTPUT_TOKENS / 1_000_000) * pricing.outputPer1M
  }
  return { count, estimatedCostUsd }
}
