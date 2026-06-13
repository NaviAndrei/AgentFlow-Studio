/**
 * Declarative provider registry. Each entry fully describes a provider:
 * which transport it speaks, its defaults, and how the settings modal
 * should render it. Adding a provider that speaks an existing transport
 * is a single new descriptor here — no UI or client changes.
 */
import { GEMINI_MODEL_TIERS } from './gemini'
import type {
  ProviderDescriptor,
  ProviderGroup,
  ProviderId,
  ProviderSettings,
} from './types'

export const PROVIDERS: Record<ProviderId, ProviderDescriptor> = {
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    group: 'local',
    transport: 'ollama',
    defaults: { baseUrl: 'http://localhost:11434', apiKey: '', model: '' },
    apiKey: 'none',
    baseUrlEditable: true,
    modelInput: 'dynamic',
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio',
    group: 'local',
    transport: 'ollama',
    defaults: { baseUrl: 'http://localhost:1234', apiKey: '', model: '' },
    apiKey: 'none',
    baseUrlEditable: true,
    modelInput: 'text',
    modelPlaceholder: 'loaded model name, e.g. qwen2.5-7b-instruct',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    group: 'cloud',
    transport: 'gemini',
    defaults: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: '',
      model: 'gemini-flash',
    },
    apiKey: 'required',
    baseUrlEditable: false,
    modelInput: 'select',
    modelOptions: GEMINI_MODEL_TIERS,
    keyPlaceholder: 'AIza…',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    group: 'cloud',
    transport: 'openai-compat',
    defaults: {
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: '',
      model: 'llama-3.3-70b-versatile',
    },
    apiKey: 'required',
    baseUrlEditable: false,
    modelInput: 'text',
    keyPlaceholder: 'gsk_…',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    group: 'cloud',
    transport: 'openai-compat',
    defaults: {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      model: 'openrouter/auto',
    },
    apiKey: 'required',
    baseUrlEditable: false,
    modelInput: 'text',
    modelPlaceholder: 'e.g. anthropic/claude-sonnet-4-6',
    keyPlaceholder: 'sk-or-…',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    group: 'cloud',
    transport: 'openai-compat',
    defaults: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini',
    },
    apiKey: 'required',
    baseUrlEditable: false,
    modelInput: 'text',
    keyPlaceholder: 'sk-…',
  },
  custom: {
    id: 'custom',
    label: 'Custom URL',
    group: 'cloud',
    transport: 'openai-compat',
    defaults: { baseUrl: '', apiKey: '', model: '' },
    apiKey: 'optional',
    baseUrlEditable: true,
    modelInput: 'text',
    modelPlaceholder: 'model id expected by the endpoint',
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

/** Providers in display order, grouped for the LOCAL / CLOUD modal sections. */
export function providersInGroup(group: ProviderGroup): ProviderDescriptor[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]).filter(
    (p) => p.group === group,
  )
}

/** Fresh per-provider settings seeded from each descriptor's defaults. */
export function defaultProviderSettings(): Record<ProviderId, ProviderSettings> {
  return Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, { ...PROVIDERS[id].defaults }]),
  ) as Record<ProviderId, ProviderSettings>
}
