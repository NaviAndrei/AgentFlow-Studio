import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelRightClose, PanelRightOpen, RotateCcw, Search } from 'lucide-react'
import { COMPUTER_USE_MODELS } from '../data/modelPricing'
import { NODE_META } from '../nodes'
import { ICON_OPTIONS } from '../nodes/iconOptions'
import {
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  useUIStore,
} from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'
import { isInsecureRemoteUrl } from '../llm'
import { listTools } from '../utils/mcpClient'
import { StateInspector } from './StateInspector'
import { HintIcon } from './HintIcon'
import { HINTS } from '../data/hints'
import { MODEL_PRESETS } from '../utils/exportModels'
import { usePromptStore } from '../store/promptStore'
import { ExternalLink, Link as LinkIcon, X } from 'lucide-react'
import type { AgentFlowNodeData, MemoryType } from '../types'

const inputCls =
  'w-full rounded-md border border-white/10 bg-surface-2 px-2 py-1.5 text-xs text-gray-200 focus:border-accent focus:outline-none'
const labelCls = 'mb-1 block text-[10px] uppercase tracking-wider text-gray-500'
const labelHintCls = 'mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500'

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

/** "Link to registry" affordance shown below a prompt textarea. */
function SystemPromptRegistryLink({ data, update }: FieldsProps) {
  const entries = usePromptStore((s) => s.entries)
  const setRegistryOpen = usePromptStore((s) => s.setRegistryOpen)
  const [pickerOpen, setPickerOpen] = useState(false)

  const linkedEntry = entries.find((e) => e.id === data.systemPromptRef)
  const candidates = entries.filter(
    (e) => e.category === 'system' || e.category === 'general',
  )

  if (linkedEntry) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <span className="flex-1 truncate rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
          {linkedEntry.name}
        </span>
        <button
          onClick={() => setRegistryOpen(true)}
          title="Edit in registry"
          className="text-gray-500 hover:text-accent"
        >
          <ExternalLink size={11} />
        </button>
        <button
          onClick={() => update({ systemPromptRef: undefined })}
          title="Unlink"
          className="text-gray-500 hover:text-red-400"
        >
          <X size={11} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative mt-1">
      <button
        onClick={() => setPickerOpen((open) => !open)}
        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-accent"
      >
        <LinkIcon size={10} />
        Link to registry
      </button>
      {pickerOpen && (
        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border border-white/10 bg-surface-2 shadow-xl">
          {candidates.length === 0 && (
            <p className="px-2 py-1.5 text-[10px] text-gray-500">
              No registry prompts yet.
            </p>
          )}
          {candidates.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                update({ systemPromptRef: entry.id })
                setPickerOpen(false)
              }}
              className="block w-full truncate px-2 py-1 text-left text-[10px] text-gray-300 hover:bg-white/5"
            >
              {entry.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LLMFields({ data, update }: FieldsProps) {
  const temperature = data.temperature ?? 0.7
  return (
    <>
      <label className="block">
        <span className={labelCls}>Model</span>
        <input
          className={inputCls}
          list="llm-model-presets"
          value={data.model ?? ''}
          onChange={(e) => update({ model: e.target.value })}
          placeholder="e.g. gemini-2.5-flash"
        />
        <datalist id="llm-model-presets">
          {MODEL_PRESETS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="mt-1 text-[10px] text-gray-600">
          Used for export; Live mode uses the connection settings unless
          Override model is set.
        </p>
      </label>
      <label className="block">
        <span className={labelCls}>Override model</span>
        <input
          className={inputCls}
          value={data.modelOverride ?? ''}
          onChange={(e) => update({ modelOverride: e.target.value })}
          placeholder="Use global setting"
        />
        <p className="mt-1 text-[10px] text-gray-600">
          Live mode only — sends this model id to the configured provider
          instead of the global one.
        </p>
      </label>
      <label className="block">
        <span className={labelHintCls}>
          System prompt
          <HintIcon text={HINTS.fields.systemPrompt} />
        </span>
        <textarea
          className={`${inputCls} h-28 resize-none`}
          value={data.systemPrompt ?? ''}
          onChange={(e) => update({ systemPrompt: e.target.value })}
        />
        <SystemPromptRegistryLink data={data} update={update} />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Temperature <span className="text-accent">{temperature.toFixed(1)}</span>
          <HintIcon text={HINTS.fields.temperature} />
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
        <span className={labelHintCls}>
          Max iterations
          <HintIcon text={HINTS.fields.maxIterations} />
        </span>
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
        <span className={labelHintCls}>
          Input schema
          <HintIcon text={HINTS.fields.toolSchema} />
        </span>
        <input
          className={inputCls}
          value={data.inputSchema ?? ''}
          onChange={(e) => update({ inputSchema: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Output schema
          <HintIcon text={HINTS.fields.toolSchema} />
        </span>
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
      <span className={labelHintCls}>
        Memory type
        <HintIcon text={HINTS.fields.memoryType} />
      </span>
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
      <p className="mt-1 text-[10px] text-gray-600">
        Each branch is a keyword tested against the latest content and must
        match an outgoing edge label. The last branch is the else.
      </p>
    </label>
  )
}

function RouterFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Routes (one per line)</span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={(data.routes ?? []).join('\n')}
          onChange={(e) => update({ routes: e.target.value.split('\n') })}
        />
        <p className="mt-1 text-[10px] text-gray-600">
          Each route is an output handle; connect it to a downstream node. Edge
          labels are set automatically.
        </p>
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Routing instruction
          <HintIcon text={HINTS.fields.routingPrompt} />
        </span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={data.routingPrompt ?? ''}
          onChange={(e) => update({ routingPrompt: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Override model</span>
        <input
          className={inputCls}
          value={data.modelOverride ?? ''}
          onChange={(e) => update({ modelOverride: e.target.value })}
          placeholder="Use global setting"
        />
        <p className="mt-1 text-[10px] text-gray-600">
          Live mode classifier model; export falls back to the first LLM node.
        </p>
      </label>
    </>
  )
}

function GuardrailFields({ data, update }: FieldsProps) {
  const checkType = data.checkType ?? 'keyword'
  return (
    <>
      <label className="block">
        <span className={labelHintCls}>
          Check type
          <HintIcon text={HINTS.fields.checkType} />
        </span>
        <select
          className={inputCls}
          value={checkType}
          onChange={(e) =>
            update({ checkType: e.target.value as 'keyword' | 'llm-judge' })
          }
        >
          <option value="keyword">keyword</option>
          <option value="llm-judge">llm-judge</option>
        </select>
      </label>
      <label className="block">
        <span className={labelHintCls}>
          {checkType === 'keyword' ? 'Required keywords' : 'Judge rubric'}
          <HintIcon text={HINTS.fields.criteria} />
        </span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={data.criteria ?? ''}
          onChange={(e) => update({ criteria: e.target.value })}
          placeholder={
            checkType === 'keyword'
              ? 'comma or newline separated — passes if any appears'
              : 'describe what a passing response looks like'
          }
        />
      </label>
      {checkType === 'llm-judge' && (
        <label className="block">
          <span className={labelCls}>Override model</span>
          <input
            className={inputCls}
            value={data.modelOverride ?? ''}
            onChange={(e) => update({ modelOverride: e.target.value })}
            placeholder="Use global setting"
          />
        </label>
      )}
      <p className="text-[10px] text-gray-600">
        Connect the <span className="text-gray-400">pass</span> and{' '}
        <span className="text-gray-400">fail</span> handles to downstream nodes.
      </p>
    </>
  )
}

function JoinFields({ data, update }: FieldsProps) {
  return (
    <>
      <p className="text-[10px] text-gray-600">
        Waits for every incoming branch (executed or skipped) before merging.
      </p>
      <label className="block">
        <span className={labelHintCls}>
          Merge strategy
          <HintIcon text={HINTS.fields.mergeStrategy} />
        </span>
        <select
          className={inputCls}
          value={data.mergeStrategy ?? 'concat'}
          onChange={(e) =>
            update({ mergeStrategy: e.target.value as 'concat' | 'last' })
          }
        >
          <option value="concat">concat — collect all branch outputs</option>
          <option value="last">last — keep the final branch output</option>
        </select>
      </label>
    </>
  )
}

function LoopFields({ data, update }: FieldsProps) {
  return (
    <label className="block">
      <span className={labelHintCls}>
        Loop until
        <HintIcon text={HINTS.fields.loopCondition} />
      </span>
      <input
        className={inputCls}
        value={data.loopCondition ?? ''}
        onChange={(e) => update({ loopCondition: e.target.value })}
      />
    </label>
  )
}

function CodeExecutorFields({ data, update }: FieldsProps) {
  const language = data.language ?? 'python'
  return (
    <>
      <label className="block">
        <span className={labelCls}>Language</span>
        <select
          className={inputCls}
          value={language}
          onChange={(e) =>
            update({
              language: e.target.value as 'python' | 'javascript' | 'bash',
            })
          }
        >
          <option value="python">python</option>
          <option value="javascript">javascript</option>
          <option value="bash">bash</option>
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Timeout (seconds)</span>
        <input
          type="number"
          min={1}
          className={inputCls}
          value={data.timeout ?? 30}
          onChange={(e) =>
            update({ timeout: Math.max(1, Number(e.target.value) || 1) })
          }
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-300">
        <input
          type="checkbox"
          checked={data.allowNetworkAccess ?? false}
          onChange={(e) => update({ allowNetworkAccess: e.target.checked })}
        />
        <span>Allow network access</span>
        <HintIcon text={HINTS.fields.allowNetworkAccess} />
      </label>
      <p className="text-[10px] text-gray-600">
        Sandbox the LLM's generated code. Pair with a downstream Condition
        that branches on <code>exit_code</code> to drive a self-correct loop.
      </p>
    </>
  )
}

function MultimodalInputFields({ data, update }: FieldsProps) {
  const inputType = data.inputType ?? 'image'
  return (
    <>
      <label className="block">
        <span className={labelCls}>Input type</span>
        <select
          className={inputCls}
          value={inputType}
          onChange={(e) =>
            update({
              inputType: e.target.value as
                | 'image'
                | 'audio'
                | 'document'
                | 'mixed',
            })
          }
        >
          <option value="image">image</option>
          <option value="audio">audio</option>
          <option value="document">document</option>
          <option value="mixed">mixed</option>
        </select>
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Input variable
          <HintIcon text={HINTS.fields.inputVariable} />
        </span>
        <input
          className={inputCls}
          value={data.inputVariable ?? ''}
          onChange={(e) => update({ inputVariable: e.target.value })}
          placeholder="file_input"
        />
      </label>
      <label className="block">
        <span className={labelCls}>Text prompt</span>
        <textarea
          className={`${inputCls} h-16 resize-none`}
          value={data.textPrompt ?? ''}
          onChange={(e) => update({ textPrompt: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Encoding
          <HintIcon text={HINTS.fields.encoding} />
        </span>
        <select
          className={inputCls}
          value={data.encoding ?? 'url'}
          onChange={(e) =>
            update({ encoding: e.target.value as 'base64' | 'url' })
          }
        >
          <option value="url">url</option>
          <option value="base64">base64</option>
        </select>
      </label>
      <p className="text-[10px] text-gray-600">
        Entry point for vision pipelines. Audio input requires an OpenAI or
        Gemini model — not all providers support it.
      </p>
    </>
  )
}

function A2AAgentFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Agent name</span>
        <input
          className={inputCls}
          value={data.agentName ?? ''}
          onChange={(e) => update({ agentName: e.target.value })}
          placeholder="Remote Agent"
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Agent A2A URL
          <HintIcon text={HINTS.fields.agentUrl} />
        </span>
        <input
          className={inputCls}
          value={data.agentUrl ?? ''}
          onChange={(e) => update({ agentUrl: e.target.value })}
          placeholder="http://localhost:8000/a2a"
        />
      </label>
      <label className="block">
        <span className={labelCls}>Task description</span>
        <textarea
          className={`${inputCls} h-16 resize-none`}
          value={data.taskDescription ?? ''}
          onChange={(e) => update({ taskDescription: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Auth token (optional)
          <HintIcon text={HINTS.fields.authToken} />
        </span>
        <input
          type="password"
          className={inputCls}
          value={data.authToken ?? ''}
          onChange={(e) => update({ authToken: e.target.value })}
          placeholder="Bearer token"
        />
      </label>
      <label className="block">
        <span className={labelCls}>Timeout (seconds)</span>
        <input
          type="number"
          min={1}
          className={inputCls}
          value={data.timeoutSeconds ?? 30}
          onChange={(e) =>
            update({ timeoutSeconds: Math.max(1, Number(e.target.value) || 1) })
          }
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Sim stubs the round-trip. Live execution requires a running A2A server
        at the URL above — it is not called from the browser.
      </p>
    </>
  )
}

const COMPUTER_USE_TOOLS = ['screenshot', 'click', 'type', 'scroll', 'keypress']

function ComputerUseFields({ data, update }: FieldsProps) {
  const allowed = data.allowedTools ?? []
  const toggle = (tool: string) => {
    const next = allowed.includes(tool)
      ? allowed.filter((t) => t !== tool)
      : [...allowed, tool]
    update({ allowedTools: next })
  }
  return (
    <>
      <label className="block">
        <span className={labelCls}>Task</span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={data.task ?? ''}
          onChange={(e) => update({ task: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Model</span>
        <select
          className={inputCls}
          value={data.model ?? COMPUTER_USE_MODELS[1]}
          onChange={(e) => update({ model: e.target.value })}
        >
          {COMPUTER_USE_MODELS.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Max steps
          <HintIcon text={HINTS.fields.maxSteps} />
        </span>
        <input
          type="number"
          min={1}
          className={inputCls}
          value={data.maxSteps ?? 10}
          onChange={(e) =>
            update({ maxSteps: Math.max(1, Number(e.target.value) || 1) })
          }
        />
      </label>
      <div className="block">
        <span className={labelHintCls}>
          Allowed tools
          <HintIcon text={HINTS.fields.allowedTools} />
        </span>
        <div className="space-y-1">
          {COMPUTER_USE_TOOLS.map((tool) => (
            <label
              key={tool}
              className="flex items-center gap-2 text-xs text-gray-300"
            >
              <input
                type="checkbox"
                checked={allowed.includes(tool)}
                onChange={() => toggle(tool)}
              />
              <span>{tool}</span>
            </label>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-gray-600">
        Sim: stubs a screenshot→action loop. Computer-use requires a
        sandboxed browser environment; export emits the real
        <code> computer_20241022</code> tool loop.
      </p>
    </>
  )
}

function PlannerFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelHintCls}>
          Decomposition prompt
          <HintIcon text={HINTS.fields.decompositionPrompt} />
        </span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={data.decompositionPrompt ?? ''}
          onChange={(e) => update({ decompositionPrompt: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Max tasks</span>
        <input
          type="number"
          min={1}
          className={inputCls}
          value={data.maxTasks ?? 5}
          onChange={(e) =>
            update({ maxTasks: Math.max(1, Number(e.target.value) || 1) })
          }
        />
      </label>
      <label className="block">
        <span className={labelCls}>Override model</span>
        <input
          className={inputCls}
          value={data.modelOverride ?? ''}
          onChange={(e) => update({ modelOverride: e.target.value })}
          placeholder="Use global setting"
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Emits a <code>todos</code> list — feed it to a Map node for parallel
        execution of each subtask.
      </p>
    </>
  )
}

function SubagentFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Role</span>
        <input
          className={inputCls}
          value={data.role ?? ''}
          onChange={(e) => update({ role: e.target.value })}
          placeholder="Researcher"
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Task input variable
          <HintIcon text={HINTS.fields.taskInput} />
        </span>
        <input
          className={inputCls}
          value={data.taskInput ?? ''}
          onChange={(e) => update({ taskInput: e.target.value })}
          placeholder="task"
        />
      </label>
      <label className="block">
        <span className={labelCls}>Tools (one per line)</span>
        <textarea
          className={`${inputCls} h-16 resize-none`}
          value={(data.tools ?? []).join('\n')}
          onChange={(e) =>
            update({
              tools: e.target.value.split('\n').filter((t) => t.trim()),
            })
          }
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Max iterations
          <HintIcon text={HINTS.fields.maxIterations} />
        </span>
        <input
          type="number"
          min={1}
          className={inputCls}
          value={data.maxIterations ?? 5}
          onChange={(e) =>
            update({
              maxIterations: Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Runs in isolated context (clean message history). Pair with Map to
        spawn one subagent per todo.
      </p>
    </>
  )
}

function LongTermStoreFields({ data, update }: FieldsProps) {
  const op = data.storeOperation ?? 'read'
  return (
    <>
      <label className="block">
        <span className={labelHintCls}>
          Namespace
          <HintIcon text={HINTS.fields.namespace} />
        </span>
        <input
          className={inputCls}
          value={data.namespace ?? ''}
          onChange={(e) => update({ namespace: e.target.value })}
          placeholder="user_memories"
        />
        <p className="mt-1 text-[10px] text-gray-600">
          Partition key, e.g. <code>user_memories</code> or{' '}
          <code>(user_id, 'memories')</code>.
        </p>
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Operation
          <HintIcon text={HINTS.fields.storeOperation} />
        </span>
        <select
          className={inputCls}
          value={op}
          onChange={(e) =>
            update({
              storeOperation: e.target.value as 'read' | 'write' | 'search',
            })
          }
        >
          <option value="read">read</option>
          <option value="write">write</option>
          <option value="search">search (semantic)</option>
        </select>
      </label>
      {op === 'search' && (
        <label className="block">
          <span className={labelCls}>Search query</span>
          <input
            className={inputCls}
            value={data.searchQuery ?? ''}
            onChange={(e) => update({ searchQuery: e.target.value })}
            placeholder="latest user message"
          />
        </label>
      )}
      <p className="text-[10px] text-gray-600">
        Cross-thread memory (LangGraph Store). Distinct from the short-term
        Memory checkpointer; export emits <code>compile(store=...)</code>.
      </p>
    </>
  )
}

function MemoryWriterFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelHintCls}>
          Memory kind
          <HintIcon text={HINTS.fields.memoryKind} />
        </span>
        <select
          className={inputCls}
          value={data.memoryKind ?? 'episodic'}
          onChange={(e) =>
            update({
              memoryKind: e.target.value as
                | 'episodic'
                | 'semantic'
                | 'procedural',
            })
          }
        >
          <option value="episodic">episodic (events)</option>
          <option value="semantic">semantic (facts)</option>
          <option value="procedural">procedural (rules)</option>
        </select>
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Extraction prompt
          <HintIcon text={HINTS.fields.extractionPrompt} />
        </span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={data.extractionPrompt ?? ''}
          onChange={(e) => update({ extractionPrompt: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Write to namespace</span>
        <input
          className={inputCls}
          value={data.writeNamespace ?? ''}
          onChange={(e) => update({ writeNamespace: e.target.value })}
          placeholder="user_memories"
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Background memory extraction (LangMem). Pairs with a Long-Term Store
        on the canvas.
      </p>
    </>
  )
}

function SubgraphFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelCls}>Subgraph reference</span>
        <input
          className={inputCls}
          value={data.subgraphRef ?? ''}
          onChange={(e) => update({ subgraphRef: e.target.value })}
          placeholder="research-team"
        />
        <p className="mt-1 text-[10px] text-gray-600">
          Identifier of another canvas/blueprint compiled and added as one node.
        </p>
      </label>
      <label className="block">
        <span className={labelCls}>Summary</span>
        <textarea
          className={`${inputCls} h-16 resize-none`}
          value={data.subgraphSummary ?? ''}
          onChange={(e) => update({ subgraphSummary: e.target.value })}
          placeholder="What does this inner graph do?"
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Input mapping (JSON)
          <HintIcon text={HINTS.fields.ioMapping} />
        </span>
        <textarea
          className={`${inputCls} h-16 resize-none font-mono`}
          value={data.inputMapping ?? '{}'}
          onChange={(e) => update({ inputMapping: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Output mapping (JSON)
          <HintIcon text={HINTS.fields.ioMapping} />
        </span>
        <textarea
          className={`${inputCls} h-16 resize-none font-mono`}
          value={data.outputMapping ?? '{}'}
          onChange={(e) => update({ outputMapping: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-300">
        <input
          type="checkbox"
          checked={data.appendToParent ?? false}
          onChange={(e) => update({ appendToParent: e.target.checked })}
        />
        <span>Append result to parent transcript</span>
        <HintIcon text={HINTS.fields.appendToParent} />
      </label>
      <p className="text-[10px] text-gray-600">
        Sim: executes as one opaque step. Export emits a real compiled
        subgraph added via <code>builder.add_node</code>.
      </p>
    </>
  )
}

function EvaluatorFields({ data, update }: FieldsProps) {
  const scoreType = data.scoreType ?? 'pass_fail'
  return (
    <>
      <label className="block">
        <span className={labelCls}>Scoring prompt</span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={data.scoringPrompt ?? ''}
          onChange={(e) => update({ scoringPrompt: e.target.value })}
          placeholder="Describe what passes vs fails."
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          Score type
          <HintIcon text={HINTS.fields.scoreType} />
        </span>
        <select
          className={inputCls}
          value={scoreType}
          onChange={(e) => {
            const next = e.target.value as
              | 'pass_fail'
              | 'numeric'
              | 'letter_grade'
            const defaults: Record<typeof next, string[]> = {
              pass_fail: ['pass', 'fail'],
              numeric: ['high', 'medium', 'low'],
              letter_grade: ['A', 'B', 'C', 'F'],
            }
            update({ scoreType: next, evalBranches: defaults[next] })
          }}
        >
          <option value="pass_fail">pass / fail</option>
          <option value="numeric">numeric (high / medium / low)</option>
          <option value="letter_grade">letter grade</option>
        </select>
      </label>
      {scoreType === 'numeric' && (
        <label className="block">
          <span className={labelHintCls}>
            Threshold (pass if score ≥)
            <HintIcon text={HINTS.fields.threshold} />
          </span>
          <input
            type="number"
            className={inputCls}
            value={data.threshold ?? 7}
            onChange={(e) =>
              update({ threshold: Number(e.target.value) || 0 })
            }
          />
        </label>
      )}
      <label className="block">
        <span className={labelCls}>Branches (one per line, last = else)</span>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={(data.evalBranches ?? []).join('\n')}
          onChange={(e) =>
            update({ evalBranches: e.target.value.split('\n') })
          }
        />
        <p className="mt-1 text-[10px] text-gray-600">
          Each branch is an output handle and must match an outgoing edge label.
        </p>
      </label>
      <label className="block">
        <span className={labelCls}>Override model</span>
        <input
          className={inputCls}
          value={data.modelOverride ?? ''}
          onChange={(e) => update({ modelOverride: e.target.value })}
          placeholder="Use global setting"
        />
      </label>
    </>
  )
}

function MapFields({ data, update }: FieldsProps) {
  const items = data.mapItems ?? []
  const itemsText = items.join('\n')
  const hasItems = items.some((it) => it.trim() !== '')
  return (
    <>
      <label className="block">
        <span className={labelHintCls}>
          List source (state key)
          <HintIcon text={HINTS.fields.mapListSource} />
        </span>
        <input
          className={inputCls}
          value={data.inputExpression ?? ''}
          onChange={(e) => update({ inputExpression: e.target.value })}
          placeholder="items"
        />
        <p className="mt-1 text-[10px] text-gray-600">
          The list in state to fan out over (LangGraph Send).
        </p>
      </label>
      <label className="block">
        <span className={labelCls}>Items (one per line)</span>
        <textarea
          className={`${inputCls} h-20 resize-none font-mono`}
          value={itemsText}
          onChange={(e) =>
            update({
              mapItems: e.target.value.split('\n').map((s) => s.trim()),
            })
          }
          placeholder="Chapter 1&#10;Chapter 2&#10;Chapter 3"
        />
        <p className="mt-1 text-[10px] text-gray-600">
          Simulation only: each item spawns one parallel branch. Empty falls
          back to Count.
        </p>
      </label>
      {!hasItems && (
        <label className="block">
          <span className={labelCls}>Count</span>
          <input
            type="number"
            min={1}
            max={10}
            className={inputCls}
            value={data.mapCount ?? 3}
            onChange={(e) =>
              update({
                mapCount: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
              })
            }
          />
        </label>
      )}
      <label className="block">
        <span className={labelHintCls}>
          Max parallel
          <HintIcon text={HINTS.fields.maxParallel} />
        </span>
        <input
          type="number"
          min={1}
          className={inputCls}
          value={data.maxParallel ?? 10}
          onChange={(e) =>
            update({ maxParallel: Math.max(1, Number(e.target.value) || 1) })
          }
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Sim: spawns one virtual branch per item. Exported Python emits a real{' '}
        <code>Send</code> per item.
      </p>
    </>
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
        <span className={labelHintCls}>
          Top-k <span className="text-accent">{topK}</span>
          <HintIcon text={HINTS.fields.topK} />
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
        <span className={labelHintCls}>
          Similarity threshold{' '}
          <span className="text-accent">{threshold.toFixed(2)}</span>
          <HintIcon text={HINTS.fields.similarityThreshold} />
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
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const discoveredTools = data.discoveredTools ?? []
  const selectedTools = data.selectedTools ?? []

  const discover = () => {
    const url = (data.serverUrl ?? '').trim()
    if (!url) {
      setDiscoverError('Enter a server URL first')
      return
    }
    setIsDiscovering(true)
    setDiscoverError(null)
    void listTools(url, data.authToken)
      .then((result) =>
        update({
          discoveredTools: result,
          mcpTools: result.map((t) => t.name),
          selectedTools: result.map((t) => t.name),
        }),
      )
      .catch((error: unknown) =>
        setDiscoverError(
          error instanceof Error ? error.message : 'Discovery failed',
        ),
      )
      .finally(() => setIsDiscovering(false))
  }

  const toggleTool = (name: string) => {
    const next = selectedTools.includes(name)
      ? selectedTools.filter((t) => t !== name)
      : [...selectedTools, name]
    update({ selectedTools: next, mcpTools: next })
  }

  const selectAll = () => {
    const names = discoveredTools.map((t) => t.name)
    update({ selectedTools: names, mcpTools: names })
  }

  const deselectAll = () => {
    update({ selectedTools: [], mcpTools: [] })
  }

  return (
    <>
      <label className="block">
        <span className={labelHintCls}>
          Server URL
          <HintIcon text={HINTS.fields.serverUrl} />
        </span>
        <input
          className={inputCls}
          value={data.serverUrl ?? ''}
          onChange={(e) => update({ serverUrl: e.target.value })}
        />
        {isInsecureRemoteUrl(data.serverUrl ?? '') && (
          <p className="mt-1 text-[10px] text-amber-400">
            Remote non-HTTPS URL — tool calls travel unencrypted.
          </p>
        )}
      </label>
      <label className="block">
        <span className={labelCls}>Auth token</span>
        <input
          className={inputCls}
          type="password"
          value={data.authToken ?? ''}
          onChange={(e) => update({ authToken: e.target.value })}
        />
      </label>
      <button
        onClick={discover}
        disabled={isDiscovering}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent/50 px-2 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Search size={13} />
        {isDiscovering ? 'Discovering…' : 'Discover Tools'}
      </button>
      {discoverError && (
        <p className="text-[10px] text-red-400">{discoverError}</p>
      )}
      <div>
        <div className="flex items-center justify-between">
          <span className={labelCls}>
            Discovered tools ({discoveredTools.length})
          </span>
          {discoveredTools.length > 0 && (
            <div className="flex gap-2 text-[10px]">
              <button
                onClick={selectAll}
                className="text-accent hover:underline"
              >
                Select all
              </button>
              <button
                onClick={deselectAll}
                className="text-gray-500 hover:underline"
              >
                Deselect all
              </button>
            </div>
          )}
        </div>
        {discoveredTools.length === 0 ? (
          <p className="text-[10px] text-gray-600">None yet.</p>
        ) : (
          <ul className="space-y-1">
            {discoveredTools.map((tool) => (
              <li key={tool.name} className="rounded bg-surface-2 px-2 py-1">
                <label className="flex items-start gap-2 text-[11px] text-gray-300">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-accent"
                    checked={selectedTools.includes(tool.name)}
                    onChange={() => toggleTool(tool.name)}
                  />
                  <span className="flex-1">
                    <span className="block truncate">{tool.name}</span>
                    {tool.description && (
                      <span className="block truncate text-[10px] text-gray-500">
                        {truncateDescription(tool.description, 60)}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function truncateDescription(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function StructuredOutputFields({ data, update }: FieldsProps) {
  return (
    <>
      <label className="block">
        <span className={labelHintCls}>
          Pydantic model name
          <HintIcon text={HINTS.fields.pydanticModel} />
        </span>
        <input
          className={inputCls}
          value={data.pydanticModel ?? ''}
          onChange={(e) => update({ pydanticModel: e.target.value })}
        />
      </label>
      <label className="block">
        <span className={labelHintCls}>
          JSON schema
          <HintIcon text={HINTS.fields.jsonSchema} />
        </span>
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

const CATCH_ERROR_OPTIONS: { value: 'timeout' | 'rate_limit' | 'network' | 'any'; label: string }[] = [
  { value: 'timeout', label: 'Timeout' },
  { value: 'rate_limit', label: 'Rate limit' },
  { value: 'network', label: 'Network' },
  { value: 'any', label: 'Any' },
]

function TryCatchFields({ data, update }: FieldsProps) {
  const tryCatch = data.tryCatch ?? { catchErrors: ['any'], fallbackOutput: '' }
  const toggle = (value: (typeof CATCH_ERROR_OPTIONS)[number]['value']) => {
    const next = tryCatch.catchErrors.includes(value)
      ? tryCatch.catchErrors.filter((e) => e !== value)
      : [...tryCatch.catchErrors, value]
    update({ tryCatch: { ...tryCatch, catchErrors: next } })
  }
  return (
    <>
      <div className="block">
        <span className={labelCls}>Catch errors</span>
        <div className="space-y-1">
          {CATCH_ERROR_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-xs text-gray-300"
            >
              <input
                type="checkbox"
                checked={tryCatch.catchErrors.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="block">
        <span className={labelCls}>Fallback output</span>
        <textarea
          className={`${inputCls} h-16 resize-none`}
          value={tryCatch.fallbackOutput}
          onChange={(e) => update({ tryCatch: { ...tryCatch, fallbackOutput: e.target.value } })}
        />
      </label>
    </>
  )
}

const RETRY_ON_OPTIONS: { value: 'error' | 'empty_output' | 'any'; label: string }[] = [
  { value: 'error', label: 'Error' },
  { value: 'empty_output', label: 'Empty output' },
  { value: 'any', label: 'Any' },
]

function RetryFields({ data, update }: FieldsProps) {
  const retry = data.retry ?? {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2.0,
    retryOn: ['error'],
  }
  const toggle = (value: (typeof RETRY_ON_OPTIONS)[number]['value']) => {
    const next = retry.retryOn.includes(value)
      ? retry.retryOn.filter((e) => e !== value)
      : [...retry.retryOn, value]
    update({ retry: { ...retry, retryOn: next } })
  }
  return (
    <>
      <label className="block">
        <span className={labelCls}>Max attempts</span>
        <input
          type="number"
          min={1}
          max={10}
          className={inputCls}
          value={retry.maxAttempts}
          onChange={(e) =>
            update({
              retry: { ...retry, maxAttempts: Math.min(10, Math.max(1, Number(e.target.value) || 1)) },
            })
          }
        />
      </label>
      <label className="block">
        <span className={labelCls}>Initial backoff (ms)</span>
        <input
          type="number"
          min={100}
          max={30000}
          step={100}
          className={inputCls}
          value={retry.backoffMs}
          onChange={(e) =>
            update({
              retry: { ...retry, backoffMs: Math.min(30000, Math.max(100, Number(e.target.value) || 100)) },
            })
          }
        />
      </label>
      <div className="block">
        <span className={labelCls}>Retry on</span>
        <div className="space-y-1">
          {RETRY_ON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-xs text-gray-300"
            >
              <input
                type="checkbox"
                checked={retry.retryOn.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  )
}

function ConfigPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  // Select data and type separately: a pure position drag replaces the node
  // object but keeps the same `data` reference, so this panel won't re-render
  // while the node is being moved.
  const nodeType = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === s.selectedNodeId)?.type,
  )
  const nodeData = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === s.selectedNodeId)?.data,
  )
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  if (!selectedNodeId || !nodeData || !nodeType) {
    return (
      <p className="text-xs text-gray-500">Select a node to configure it.</p>
    )
  }

  const meta = NODE_META[nodeType]
  const Icon = meta.icon
  const update = (patch: Partial<AgentFlowNodeData>) =>
    updateNodeData(selectedNodeId, patch)
  const props: FieldsProps = { data: nodeData, update }

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
            value={nodeData.label}
            onChange={(e) => update({ label: e.target.value })}
          />
        </label>
        {nodeType === 'start' && <StartFields {...props} />}
        {nodeType === 'llm' && <LLMFields {...props} />}
        {nodeType === 'agent' && <AgentFields {...props} />}
        {nodeType === 'tool' && <ToolFields {...props} />}
        {nodeType === 'memory' && <MemoryFields {...props} />}
        {nodeType === 'condition' && <ConditionFields {...props} />}
        {nodeType === 'router' && <RouterFields {...props} />}
        {nodeType === 'guardrail' && <GuardrailFields {...props} />}
        {nodeType === 'join' && <JoinFields {...props} />}
        {nodeType === 'loop' && <LoopFields {...props} />}
        {nodeType === 'map' && <MapFields {...props} />}
        {nodeType === 'codeExecutor' && <CodeExecutorFields {...props} />}
        {nodeType === 'evaluator' && <EvaluatorFields {...props} />}
        {nodeType === 'subgraph' && <SubgraphFields {...props} />}
        {nodeType === 'longTermStore' && <LongTermStoreFields {...props} />}
        {nodeType === 'memoryWriter' && <MemoryWriterFields {...props} />}
        {nodeType === 'planner' && <PlannerFields {...props} />}
        {nodeType === 'subagent' && <SubagentFields {...props} />}
        {nodeType === 'computerUse' && <ComputerUseFields {...props} />}
        {nodeType === 'a2aAgent' && <A2AAgentFields {...props} />}
        {nodeType === 'multimodalInput' && <MultimodalInputFields {...props} />}
        {(nodeType === 'humanInLoop' ||
          nodeType === 'supervisor' ||
          nodeType === 'swarmWorker') && <DescriptionFields {...props} />}
        {nodeType === 'retriever' && <RetrieverFields {...props} />}
        {nodeType === 'mcpServer' && <MCPServerFields {...props} />}
        {nodeType === 'structuredOutput' && (
          <StructuredOutputFields {...props} />
        )}
        {nodeType === 'tryCatch' && <TryCatchFields {...props} />}
        {nodeType === 'retry' && <RetryFields {...props} />}
        {nodeType === 'note' && <NoteFields {...props} />}
        {nodeType !== 'note' && nodeType !== 'group' && (
          <AppearanceFields {...props} />
        )}
      </div>
    </>
  )
}

export function Inspector() {
  const simActive = useSimulationStore((s) => s.isActive)
  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const toggleInspector = useUIStore((s) => s.toggleInspector)
  const inspectorWidth = useUIStore((s) => s.inspectorWidth)
  const setInspectorWidth = useUIStore((s) => s.setInspectorWidth)
  const [tab, setTab] = useState<'config' | 'state'>('config')
  const asideRef = useRef<HTMLElement>(null)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Auto-switch to the state view when a simulation starts, back when it ends.
  useEffect(() => {
    setTab(simActive ? 'state' : 'config')
  }, [simActive])

  // Drag the left edge to resize. Mirrors PanelRail's ref-only hot path: the
  // width is mutated imperatively per pointermove (no per-frame store write,
  // which would re-render the Inspector AND PanelRail every frame), then
  // committed to the store once on pointerup.
  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      resizeRef.current = {
        startX: event.clientX,
        startWidth: useUIStore.getState().inspectorWidth,
      }
    },
    [],
  )

  const handleResizeMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = resizeRef.current
      if (!drag || !asideRef.current) return
      const raw = drag.startWidth + (drag.startX - event.clientX)
      const clamped = Math.min(
        INSPECTOR_MAX_WIDTH,
        Math.max(INSPECTOR_MIN_WIDTH, raw),
      )
      asideRef.current.style.width = `${clamped}px`
      const rail = document.getElementById('panel-rail')
      if (rail) rail.style.right = `${clamped}px`
    },
    [],
  )

  const handleResizeEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = resizeRef.current
      if (!drag) return
      event.currentTarget.releasePointerCapture(event.pointerId)
      resizeRef.current = null
      const committed = asideRef.current
        ? parseInt(asideRef.current.style.width, 10)
        : NaN
      if (!Number.isNaN(committed)) setInspectorWidth(committed)
    },
    [setInspectorWidth],
  )

  if (!inspectorOpen) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center border-l border-white/10 bg-surface py-2">
        <button
          onClick={toggleInspector}
          title="Show inspector"
          aria-label="Show inspector"
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-surface-2 hover:text-white"
        >
          <PanelRightOpen size={15} />
        </button>
      </div>
    )
  }

  return (
    <aside
      ref={asideRef}
      style={{
        width: inspectorWidth,
        // Make room for the fixed playback bar so scrolled content (e.g. the
        // last node's output in the State Inspector) isn't clipped beneath it.
        paddingBottom: simActive ? 'calc(3rem + 1rem)' : undefined,
      }}
      className="relative shrink-0 overflow-y-auto border-l border-white/10 bg-surface p-4"
    >
      <div
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector"
        title="Drag to resize"
        className="absolute inset-y-0 left-0 w-1 touch-none cursor-col-resize hover:bg-accent/40"
      />
      <div className="mb-3 flex items-center gap-1 border-b border-white/10 pb-2">
        {simActive ? (
          (
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
          ))
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Inspector
          </span>
        )}
        <button
          onClick={toggleInspector}
          title="Collapse inspector"
          aria-label="Collapse inspector"
          className="ml-auto rounded-md p-1 text-gray-500 transition-colors hover:bg-surface-2 hover:text-white"
        >
          <PanelRightClose size={14} />
        </button>
      </div>
      {simActive && tab === 'state' ? <StateInspector /> : <ConfigPanel />}
    </aside>
  )
}
