import { useState } from 'react'
import { CheckCircle2, PlugZap, Settings, XCircle } from 'lucide-react'
import { useLLMConfigStore } from '../store/llmConfigStore'
import {
  isInsecureRemoteUrl,
  listOllamaModels,
  testGeminiConnection,
} from '../utils/llmClient'
import type { GeminiModel, LLMProvider } from '../utils/llmClient'
import { Modal } from './Modal'

type TestState = 'idle' | 'testing' | 'ok' | 'error'

const inputCls =
  'w-full rounded-md border border-white/10 bg-surface-2 px-2 py-1.5 text-xs text-gray-200 focus:border-accent focus:outline-none'
const labelCls = 'mb-1 block text-[10px] uppercase tracking-wider text-gray-500'

const GEMINI_MODELS: GeminiModel[] = ['gemini-flash', 'gemini-pro']

export function LLMSettingsModal() {
  const settingsOpen = useLLMConfigStore((s) => s.settingsOpen)
  const setSettingsOpen = useLLMConfigStore((s) => s.setSettingsOpen)
  const provider = useLLMConfigStore((s) => s.provider)
  const setProvider = useLLMConfigStore((s) => s.setProvider)
  const ollamaUrl = useLLMConfigStore((s) => s.ollamaUrl)
  const setOllamaUrl = useLLMConfigStore((s) => s.setOllamaUrl)
  const ollamaModel = useLLMConfigStore((s) => s.ollamaModel)
  const setOllamaModel = useLLMConfigStore((s) => s.setOllamaModel)
  const ollamaModels = useLLMConfigStore((s) => s.ollamaModels)
  const geminiApiKey = useLLMConfigStore((s) => s.geminiApiKey)
  const setGeminiApiKey = useLLMConfigStore((s) => s.setGeminiApiKey)
  const geminiModel = useLLMConfigStore((s) => s.geminiModel)
  const setGeminiModel = useLLMConfigStore((s) => s.setGeminiModel)
  const refreshOllamaModels = useLLMConfigStore((s) => s.refreshOllamaModels)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMessage, setTestMessage] = useState('')

  if (!settingsOpen) return null

  const testConnection = () => {
    setTestState('testing')
    setTestMessage('')
    const run =
      provider === 'ollama'
        ? listOllamaModels(ollamaUrl).then(
            (models) =>
              `Connected — ${models.length} model${models.length === 1 ? '' : 's'} available`,
          )
        : testGeminiConnection(geminiApiKey, geminiModel).then(
            () => 'Connected — key and model accepted',
          )
    run
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
    <Modal
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      title="LLM Connection"
      icon={Settings}
      maxWidth="sm"
    >
        <span className={labelCls}>Provider</span>
        <div className="mb-4 flex gap-1 rounded-md border border-white/10 p-0.5">
          {(['ollama', 'gemini'] as LLMProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setProvider(p)
                setTestState('idle')
                setTestMessage('')
              }}
              className={`flex-1 rounded px-2 py-1 text-xs capitalize transition-colors ${
                provider === p
                  ? 'bg-accent/15 text-accent'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {provider === 'ollama' ? (
          <div className="space-y-3">
            <label className="block">
              <span className={labelCls}>Base URL</span>
              <input
                className={inputCls}
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
              />
              {isInsecureRemoteUrl(ollamaUrl) && (
                <p className="mt-1 text-[10px] text-amber-400">
                  Remote non-HTTPS URL — prompts and responses travel
                  unencrypted.
                </p>
              )}
            </label>
            <div>
              <span className={labelCls}>Model</span>
              <div className="flex gap-1.5">
                <select
                  className={inputCls}
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                >
                  {ollamaModels.length === 0 && (
                    <option value="">No models loaded</option>
                  )}
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
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className={labelCls}>API key</span>
              <input
                type="password"
                autoComplete="off"
                className={inputCls}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza…"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Model</span>
              <select
                className={inputCls}
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value as GeminiModel)}
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={testConnection}
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

        <p className="mt-4 text-[10px] leading-relaxed text-gray-600">
          Settings are kept in memory for this session only. Live mode sends
          LLM node prompts to the configured provider.
        </p>
    </Modal>
  )
}
