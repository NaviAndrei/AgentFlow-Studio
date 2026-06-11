import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { NODE_META } from '../nodes'
import { ICON_OPTIONS } from '../nodes/iconOptions'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'
import { discoverMcpTools } from '../utils/llmClient'
import { StateInspector } from './StateInspector'
import type { AgentFlowNodeData, LLMModel, MemoryType } from '../types'

const inputCls =
  'w-full rounded-md border border-white/10 bg-surface-2 px-2 py-1.5 text-xs text-gray-200 focus:border-accent focus:outline-none'
const labelCls = 'mb-1 block text-[10px] uppercase tracking-wider text-gray-500'

const LLM_MODELS: LLMModel[] = [
  'gemini-flash',
  'gemini-pro',
  'ollama/llama3',
  'ollama/mistral',
]
const MEMORY_TYPES: MemoryType[] = ['short-term', 'vector-store', 'checkpointer']

interface FieldsProps {
  data: AgentFlowNodeData
  update: (patch: Partial<AgentFlowNodeData>) => void
}

function StartFields({ data, update }: FieldsProps) {
  return (
    <label className="block">
      <span className={labelCls}>Input variables (one per line)</span>
      <textarea
        className={`${inputCls} h-20 resize-none`}
        value={(data.inputVariables ?? []).join('\n')}
        onChange={(e) => update({ inputVariables: e.target.value.split('\n') })}
      />
    </label>
  )
}

function LLMFields({ data, update }: FieldsProps) {
  const temperature = data.temperature ?? 0.7
  return (
    <>
      <label className="block">
        <span className={labelCls}>Model</span>
        <select
          className={inputCls}
          value={data.model ?? 'gemini-flash'}
          onChange={(e) => update({ model: e.target.value as LLMModel })}
        >
          {LLM_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>System prompt</span>
        <textarea
          className={`${inputCls} h-28 resize-none`}
          value={data.systemPrompt ?? ''}
          onChange={(e) => update({ systemPrompt: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>
          Temperature <span className="text-accent">{temperature.toFixed(1)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={(e) => update({ temperature: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </label>
    </>
  )
}

function AgentFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Tools (one per line)</span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={(data.tools ?? []).join('\n')}
          onChange={(e) => update({ tools: e.target.value.split('\n') })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Max iterations</span>
        <input
          type="number"
          min={1}
          className={inputCls}
          value={data.maxIterations ?? 10}
          onChange={(e) => update({ maxIterations: Number(e.target.value) })}
        />
      </label>
    </>
  )
}

function ToolFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Tool name</span>
        <input
          className={inputCls}
          value={data.toolName ?? ''}
          onChange={(e) => update({ toolName: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Description</span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={data.description ?? ''}
          onChange={(e) => update({ description: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Input schema</span>
        <input
          className={inputCls}
          value={data.inputSchema ?? ''}
          onChange={(e) => update({ inputSchema: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Output schema</span>
        <input
          className={inputCls}
          value={data.outputSchema ?? ''}
          onChange={(e) => update({ outputSchema: e.target.value })}
        />
      </label>
    </>
  )
}

function MemoryFields({ data, update }: FieldsProps) {
  return (
    <label className="block">
      <span className={labelCls}>Memory type</span>
      <select
        className={inputCls}
        value={data.memoryType ?? 'short-term'}
        onChange={(e) => update({ memoryType: e.target.value as MemoryType })}
      >
        {MEMORY_TYPES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  )
}

function ConditionFields({ data, update }: FieldsProps) {
  return (
    <label className="block">
      <span className={labelCls}>Branches (one per line, last = else)</span>
      <textarea
        className={`${inputCls} h-20 resize-none`}
        value={(data.branches ?? []).join('\n')}
        onChange={(e) => update({ branches: e.target.value.split('\n') })}
      />
    </label>
  )
}

function LoopFields({ data, update }: FieldsProps) {
  return (
    <label className="block">
      <span className={labelCls}>Loop until</span>
      <input
        className={inputCls}
        value={data.loopCondition ?? ''}
        onChange={(e) => update({ loopCondition: e.target.value })}
      />
    </label>
  )
}

function DescriptionFields({ data, update }: FieldsProps) {
  return (
    <label className="block">
      <span className={labelCls}>Description</span>
      <textarea
        className={`${inputCls} h-20 resize-none`}
        value={data.description ?? ''}
        onChange={(e) => update({ description: e.target.value })}
      />
    </label>
  )
}

function RetrieverFields({ data, update }: FieldsProps) {
  const topK = data.topK ?? 4
  const threshold = data.similarityThreshold ?? 0.75
  return (
    <>
      <label className="block">
        <span className={labelCls}>Knowledge base</span>
        <input
          className={inputCls}
          value={data.knowledgeBase ?? ''}
          onChange={(e) => update({ knowledgeBase: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>
          Top-k <span className="text-accent">{topK}</span>
        </span>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={topK}
          onChange={(e) => update({ topK: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </label>
      <label className="block">
        <span className={labelCls}>
          Similarity threshold{' '}
          <span className="text-accent">{threshold.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={0.99}
          step={0.01}
          value={threshold}
          onChange={(e) =>
            update({ similarityThreshold: Number(e.target.value) })
          }
          className="w-full accent-accent"
        />
      </label>
    </>
  )
}

function MCPServerFields({ data, update }: FieldsProps) {
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const tools = (data.mcpTools ?? []).filter(Boolean)

  const discover = () => {
    const url = (data.serverUrl ?? '').trim()
    if (!url) {
      setDiscoverError('Enter a server URL first')
      return
    }
    setDiscovering(true)
    setDiscoverError(null)
    void discoverMcpTools(url)
      .then((names) => update({ mcpTools: names }))
      .catch((error: unknown) =>
        setDiscoverError(
          error instanceof Error ? error.message : 'Discovery failed',
        ),
      )
      .finally(() => setDiscovering(false))
  }

  return (
    <>
      <label className="block">
        <span className={labelCls}>Server URL</span>
        <input
          className={inputCls}
          value={data.serverUrl ?? ''}
          onChange={(e) => update({ serverUrl: e.target.value })}
        />
      </label>
      <button
        onClick={discover}
        disabled={discovering}
        className="w-full rounded-md border border-accent/50 px-2 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {discovering ? 'Discovering…' : 'Discover tools'}
      </button>
      {discoverError && (
        <p className="text-[10px] text-red-400">{discoverError}</p>
      )}
      <div>
        <span className={labelCls}>
          Discovered tools ({tools.length})
        </span>
        {tools.length === 0 ? (
          <p className="text-[10px] text-gray-600">None yet.</p>
        ) : (
          <ul className="space-y-0.5 text-[11px] text-gray-300">
            {tools.map((tool) => (
              <li key={tool} className="truncate rounded bg-surface-2 px-2 py-1">
                {tool}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function StructuredOutputFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Pydantic model name</span>
        <input
          className={inputCls}
          value={data.pydanticModel ?? ''}
          onChange={(e) => update({ pydanticModel: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>JSON schema</span>
        <textarea
          className={`${inputCls} h-32 resize-none font-mono`}
          value={data.jsonSchema ?? ''}
          onChange={(e) => update({ jsonSchema: e.target.value })}
        />
      </label>
    </>
  )
}

const SWATCH_COLORS = [
  '#16a34a',
  '#7c3aed',
  '#4f46e5',
  '#ea580c',
  '#0891b2',
  '#dc2626',
  '#ca8a04',
  '#db2777',
]

function AppearanceFields({ data, update }: FieldsProps) {
  const [iconQuery, setIconQuery] = useState('')
  const icons = Object.entries(ICON_OPTIONS).filter(([name]) =>
    name.includes(iconQuery.toLowerCase().trim()),
  )
  return (
    <div className="border-t border-white/10 pt-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Appearance
      </h3>
      <span className={labelCls}>Color override</span>
      <div className="mb-3 flex items-center gap-1.5">
        {SWATCH_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => update({ color })}
            style={{ backgroundColor: color }}
            className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
              data.color === color ? 'ring-2 ring-white' : ''
            }`}
            aria-label={`Set color ${color}`}
          />
        ))}
        <button
          onClick={() => update({ color: undefined })}
          title="Reset to category color"
          className="ml-1 rounded-md border border-white/10 p-1 text-gray-400 hover:border-accent/50 hover:text-white"
        >
          <RotateCcw size={11} />
        </button>
      </div>
      <span className={labelCls}>Icon</span>
      <input
        className={`${inputCls} mb-2`}
        placeholder="Search icons…"
        value={iconQuery}
        onChange={(e) => setIconQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {icons.map(([name, Icon]) => (
          <button
            key={name}
            onClick={() => update({ icon: name })}
            title={name}
            className={`rounded-md border p-1.5 transition-colors ${
              data.icon === name
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-white/10 text-gray-400 hover:border-accent/50 hover:text-white'
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
        <button
          onClick={() => update({ icon: undefined })}
          title="Reset to category icon"
          className="rounded-md border border-white/10 p-1.5 text-gray-400 hover:border-accent/50 hover:text-white"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  )
}

function NoteFields({ data, update }: FieldsProps) {
  return (
    <label className="block">
      <span className={labelCls}>Text</span>
      <textarea
        className={`${inputCls} h-32 resize-none`}
        value={data.text ?? ''}
        onChange={(e) => update({ text: e.target.value })}
      />
    </label>
  )
}

function ConfigPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const node = useCanvasStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId),
  )
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  if (!selectedNodeId || !node || !node.type) {
    return (
      <>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Inspector
        </h2>
        <p className="text-xs text-gray-500">
          Select a node to configure it.
        </p>
      </>
    )
  }

  const meta = NODE_META[node.type]
  const Icon = meta.icon
  const update = (patch: Partial<AgentFlowNodeData>) =>
    updateNodeData(node.id, patch)
  const props: FieldsProps = { data: node.data, update }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded"
          style={{ backgroundColor: meta.color }}
        >
          <Icon size={13} className="text-white" />
        </span>
        <h2 className="text-xs font-semibold text-gray-200">{meta.label}</h2>
      </div>
      <div className="space-y-3">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input
            className={inputCls}
            value={node.data.label}
            onChange={(e) => update({ label: e.target.value })}
          />
        </label>
        {node.type === 'start' && <StartFields {...props} />}
        {node.type === 'llm' && <LLMFields {...props} />}
        {node.type === 'agent' && <AgentFields {...props} />}
        {node.type === 'tool' && <ToolFields {...props} />}
        {node.type === 'memory' && <MemoryFields {...props} />}
        {node.type === 'condition' && <ConditionFields {...props} />}
        {node.type === 'loop' && <LoopFields {...props} />}
        {(node.type === 'humanInLoop' ||
          node.type === 'supervisor' ||
          node.type === 'swarmWorker') && <DescriptionFields {...props} />}
        {node.type === 'retriever' && <RetrieverFields {...props} />}
        {node.type === 'mcpServer' && <MCPServerFields {...props} />}
        {node.type === 'structuredOutput' && (
          <StructuredOutputFields {...props} />
        )}
        {node.type === 'note' && <NoteFields {...props} />}
        {node.type !== 'note' && node.type !== 'group' && (
          <AppearanceFields {...props} />
        )}
      </div>
    </>
  )
}

export function Inspector() {
  const simActive = useSimulationStore((s) => s.isActive)
  const [tab, setTab] = useState<'config' | 'state'>('config')

  // Auto-switch to the state view when a simulation starts, back when it ends.
  useEffect(() => {
    setTab(simActive ? 'state' : 'config')
  }, [simActive])

  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-white/10 bg-surface p-4">
      {simActive && (
        <div className="mb-3 flex gap-1 border-b border-white/10 pb-2">
          {(
            [
              { key: 'config', label: 'Inspector' },
              { key: 'state', label: 'State Inspector' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                tab === t.key
                  ? 'bg-accent/15 text-accent'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {simActive && tab === 'state' ? <StateInspector /> : <ConfigPanel />}
    </aside>
  )
}
