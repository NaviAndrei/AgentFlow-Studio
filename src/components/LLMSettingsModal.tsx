import { useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  PlugZap,
  Settings,
  XCircle,
} from 'lucide-react'
import { useLLMConfigStore } from '../store/llmConfigStore'
import {
  PROVIDERS,
  isInsecureRemoteUrl,
  providersInGroup,
  testConnection,
} from '../llm'
import type { ProviderDescriptor, ProviderGroup, ProviderId } from '../llm'
import { Modal } from './Modal'

type TestState = 'idle' | 'testing' | 'ok' | 'error'

const inputCls =
  'w-full rounded-md border border-white/10 bg-surface-2 px-2 py-1.5 text-xs text-gray-200 focus:border-accent focus:outline-none'
const labelCls = 'mb-1 block text-[10px] uppercase tracking-wider text-gray-500'

const GROUPS: ProviderGroup[] = ['local', 'cloud']

interface ModelFieldProps {
  descriptor: ProviderDescriptor
  value: string
  onChange: (model: string) => void
}

/** Model control rendered per the descriptor: dynamic list, fixed select, or free text. */
function ModelField({ descriptor, value, onChange }: ModelFieldProps) {
  const ollamaModels = useLLMConfigStore((s) => s.ollamaModels)
  const refreshOllamaModels = useLLMConfigStore((s) => s.refreshOllamaModels)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  if (descriptor.modelInput === 'select') {
    return (
      <label className="block">
        <span className={labelCls}>Model</span>
        <select
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {(descriptor.modelOptions ?? []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (descriptor.modelInput === 'text') {
    return (
      <label className="block">
        <span className={labelCls}>Model</span>
        <input
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={descriptor.modelPlaceholder}
        />
      </label>
    )
  }

  const refresh = () => {
    setRefreshing(true)
    setRefreshError(null)
    refreshOllamaModels()
      .catch((error: unknown) =>
        setRefreshError(
          error instanceof Error ? error.message : 'Failed to load models',
        ),
      )
      .finally(() => setRefreshing(false))
  }

  return (
    <div>
      <span className={labelCls}>Model</span>
      <div className="flex gap-1.5">
        <select
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {ollamaModels.length === 0 && <option value="">No models loaded</option>}
          {ollamaModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="shrink-0 rounded-md border border-accent/50 px-2 py-1 text-[11px] text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {refreshing ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {refreshError && (
        <p className="mt-1 text-[10px] text-red-400">{refreshError}</p>
      )}
    </div>
  )
}

export function LLMSettingsModal() {
  const settingsOpen = useLLMConfigStore((s) => s.settingsOpen)
  const setSettingsOpen = useLLMConfigStore((s) => s.setSettingsOpen)
  const activeProvider = useLLMConfigStore((s) => s.activeProvider)
  const setActiveProvider = useLLMConfigStore((s) => s.setActiveProvider)
  const settings = useLLMConfigStore((s) => s.settings[s.activeProvider])
  const updateProviderSettings = useLLMConfigStore(
    (s) => s.updateProviderSettings,
  )
  const getConfig = useLLMConfigStore((s) => s.getConfig)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (!settingsOpen) return null

  const descriptor = PROVIDERS[activeProvider]
  const update = (patch: Partial<typeof settings>) =>
    updateProviderSettings(activeProvider, patch)

  const pickProvider = (id: ProviderId) => {
    setActiveProvider(id)
    setTestState('idle')
    setTestMessage('')
    setAdvancedOpen(false)
  }

  const pickGroup = (group: ProviderGroup) => {
    if (descriptor.group === group) return
    pickProvider(providersInGroup(group)[0].id)
  }

  const runTest = () => {
    setTestState('testing')
    setTestMessage('')
    testConnection(getConfig())
      .then((message) => {
        setTestState('ok')
        setTestMessage(message)
      })
      .catch((error: unknown) => {
        setTestState('error')
        setTestMessage(
          error instanceof Error ? error.message : 'Connection failed',
        )
      })
  }

  const baseUrlField = (
    <label className="block">
      <span className={labelCls}>Base URL</span>
      <input
        className={inputCls}
        value={settings.baseUrl}
        onChange={(e) => update({ baseUrl: e.target.value })}
        placeholder={
          descriptor.id === 'custom'
            ? 'https://example.com/v1 (OpenAI-compatible)'
            : undefined
        }
      />
      {isInsecureRemoteUrl(settings.baseUrl) && (
        <p className="mt-1 text-[10px] text-amber-400">
          Remote non-HTTPS URL — traffic is unencrypted.
        </p>
      )}
    </label>
  )

  return (
    <Modal
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      title="LLM Connection"
      icon={Settings}
      maxWidth="sm"
    >
      <div className="mb-3 flex rounded-md border border-white/10 p-0.5">
        {GROUPS.map((group) => (
          <button
            key={group}
            onClick={() => pickGroup(group)}
            className={`flex-1 rounded-[5px] py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              descriptor.group === group
                ? 'bg-accent/15 text-accent'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {group}
          </button>
        ))}
      </div>

      <label className="mb-3 block">
        <span className={labelCls}>Provider</span>
        <select
          className={inputCls}
          value={activeProvider}
          onChange={(e) => pickProvider(e.target.value as ProviderId)}
        >
          {providersInGroup(descriptor.group).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-3">
        {descriptor.apiKey !== 'none' && (
          <label className="block">
            <span className={labelCls}>
              API key{descriptor.apiKey === 'optional' && ' (optional)'}
            </span>
            <input
              type="password"
              autoComplete="off"
              className={inputCls}
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={descriptor.keyPlaceholder}
            />
          </label>
        )}

        <ModelField
          descriptor={descriptor}
          value={settings.model}
          onChange={(model) => update({ model })}
        />

        {descriptor.id === 'custom' && baseUrlField}
      </div>

      {descriptor.id !== 'custom' && (
        <div className="mt-3 border-t border-white/5 pt-2">
          <button
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-300"
          >
            <ChevronRight
              size={11}
              className={`transition-transform ${advancedOpen ? 'rotate-90' : ''}`}
            />
            Advanced
          </button>
          {advancedOpen && (
            <div className="mt-2">
              {descriptor.baseUrlEditable ? (
                baseUrlField
              ) : (
                <p className="text-[10px] text-gray-600">
                  Endpoint: {settings.baseUrl}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={runTest}
          disabled={testState === 'testing'}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent/50 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlugZap size={13} />
          {testState === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        {testState === 'ok' && (
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-green-400">
            <CheckCircle2 size={11} className="shrink-0" />
            {testMessage}
          </p>
        )}
        {testState === 'error' && (
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-red-400">
            <XCircle size={11} className="shrink-0" />
            {testMessage}
          </p>
        )}
      </div>

      <p className="mt-3 text-[10px] text-gray-600">
        Settings are memory-only and reset on reload.
      </p>
    </Modal>
  )
}
