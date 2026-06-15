export interface ModelPricing {
  inputPer1M: number
  outputPer1M: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4.1': { inputPer1M: 2.0, outputPer1M: 8.0 },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.0 },
  'claude-opus-4-5': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-sonnet-4-5': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-haiku-3-5': { inputPer1M: 0.8, outputPer1M: 4.0 },
}

export const DEFAULT_PRICING: ModelPricing = {
  inputPer1M: 2.0,
  outputPer1M: 8.0,
}

export function getPricing(modelId: string): ModelPricing {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING
}
