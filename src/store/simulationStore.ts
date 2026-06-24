import { create } from 'zustand'
import { topologicalSort } from '../utils/topologicalSort'
import { hashNodeInput } from '../utils/hashNodeInput'
import {
  estimateTokens,
  fakeOutputFor,
  fakeStreamTextFor,
  fakeTokensFor,
  nodeStepDurationMs,
  truncate,
} from '../utils/fakeData'
import { streamChat } from '../llm'
import type { ResolvedLLMConfig } from '../llm'
import { callTool } from '../utils/mcpClient'
import {
  evaluateConditionBranches,
  evaluateKeywordGuardrail,
  isRoutingType,
  joinReadiness,
  mergeJoinInputs,
  pickRouteByKeyword,
} from '../utils/flowSemantics'
import { useCanvasStore } from './canvasStore'
import { useEvalStore } from './evalStore'
import { useLLMConfigStore } from './llmConfigStore'
import { useMemoryStore } from './memoryStore'
import { useSimulationMetricsStore } from './simulationMetricsStore'
import { computeQualityScore, scoreTestCase } from '../utils/evalScorer'
import { getPricing } from '../data/modelPricing'
import { resolveNodePrompts } from '../utils/resolvePrompts'
import { detectCycle, ESCAPE_NODE_TYPES, hasEscapeOnCycle } from '../utils/validation'
import { useRunHistoryStore } from './runHistoryStore'
import { useToastStore } from './toastStore'
import type {
  AgentFlowEdge,
  AgentFlowNode,
  AgentFlowNodeType,
  ChatMessage,
  EvalResult,
  EvalRun,
  ExecutionEngine,
  NodeCostEntry,
  RunCostSummary,
  StepSnapshot,
  TraceEntry,
} from '../types'

/**
 * Attach a per-node output token cap to a resolved LLM config. Purely
 * additive: when the node has no `maxTokens`, the config is returned
 * unchanged so the provider default still applies.
 */
function withMaxTokens(
  config: ResolvedLLMConfig,
  maxTokens: number | undefined,
): ResolvedLLMConfig {
  return maxTokens === undefined ? config : { ...config, maxTokens }
}

/**
 * ── Dynamic simulation walker (architecture note) ────────────────────────
 *
 * The run is a DYNAMIC next-step walker, not a prebuilt topological pass.
 * `executionQueue` starts as just the seed node(s) and GROWS as each node
 * finishes and schedules its reachable successors. `currentNodeIndex` walks
 * that growing array; the run is finished once the index passes its end.
 *
 * 1. Where the queue is built
 *    - Seeded by buildSeeds(): Start nodes, else flow nodes with no incoming
 *      flow edge, else (pure cycle) the topological head — one node only.
 *      topologicalSort is used ONLY for that last-resort single seed, never to
 *      pre-order the whole run.
 *    - Grown by scheduleNextNodes() after every node runs, plus the join
 *      defer in executeCurrent (which re-queues a not-ready join at the tail).
 *      resetRunState() resets index/queue to the seeds for start/restart.
 *
 * 2. Where routing decisions are resolved
 *    - The `taken` value comes from the pure flowSemantics helpers
 *      (evaluateConditionBranches / pickRouteByKeyword / evaluateKeywordGuardrail),
 *      shared by the simulated and live engines so both behave identically.
 *    - resolveCondition() then maps `taken` to one outgoing edge (by label,
 *      else target id) and returns the single taken target, the updated skip
 *      set, and the newly-skipped ids. Routing node types are ROUTING_TYPES =
 *      condition, router, guardrail, evaluator (flowSemantics.isRoutingType).
 *
 * 3. How skip-marking works
 *    - When a routing node takes one edge, every node reachable ONLY via the
 *      non-taken edges (not also reachable from the taken edge, not already
 *      executed, not the routing node itself) is added to skippedNodeIds and
 *      gets a 'skipped' trace entry. scheduleNextNodes/enqueueTargets never
 *      enqueue a skipped node, and the pending tail is pruned of them.
 *
 * 4. How joins are deferred
 *    - A join at the queue head whose incoming branches have not all executed
 *      or been skipped (joinReadiness) is moved to the queue tail WITHOUT
 *      consuming visit budget. A per-join defer counter bounds the wait to the
 *      pending-queue length so an unreachable source can't livelock the run.
 *
 * 5. What still assumes a flat queue
 *    - Nothing prebuilds the whole run. The only residual flatness is
 *      cosmetic: progress is reported as currentNodeIndex / queue.length
 *      (MetricsBar) over the growing array, and finished() is an index check.
 *      Both are intentional and consistent with the dynamic growth model.
 *
 * Inner Subgraph nodes run an isolated copy of this same walker (runSubgraph),
 * mirroring the seed/skip/join/visit rules on their own local state.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Extract a tool-call request from an upstream LLM node's output. Recognizes
 * `{ tool_use: { name, input } }` and `{ name, input }` shapes, either as raw
 * JSON or inside a fenced ```json code block. Returns null for anything else.
 */
function parseToolCall(content: string): { name: string; input: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed.tool_use?.name) {
      return { name: parsed.tool_use.name, input: parsed.tool_use.input ?? {} }
    }
    if (typeof parsed.name === 'string') {
      return { name: parsed.name, input: parsed.input ?? {} }
    }
    return null
  } catch {
    const match = content.match(/```json\s*([\s\S]*?)```/)
    if (!match) return null
    return parseToolCall(match[1])
  }
}

/** Node types that take part in the simulated execution sequence. */
const SIMULATED_TYPES: AgentFlowNodeType[] = [
  'start',
  'llm',
  'agent',
  'tool',
  'memory',
  'output',
  'condition',
  'router',
  'guardrail',
  'join',
  'loop',
  'humanInLoop',
  'supervisor',
  'swarmWorker',
  'retriever',
  'mcpServer',
  'structuredOutput',
  'map',
  'codeExecutor',
  'evaluator',
  'subgraph',
  'longTermStore',
  'memoryWriter',
  'planner',
  'subagent',
  'computerUse',
  'a2aAgent',
  'multimodalInput',
  'tryCatch',
  'retry',
  'httpRequest',
]

/** Pause between node executions in the continuous run loop. */
const LOOP_GAP_MS = 250

/**
 * Executions allowed per node in one run. Cycles (ReAct-style loop-backs)
 * re-enqueue their nodes once, so a loop is shown for one extra iteration
 * and then terminates instead of running forever.
 */
const MAX_NODE_VISITS = 2

/**
 * Token budget for agent-type nodes' real LLM calls in the default: branch.
 * AgentFlowNodeData has no maxTokens field and StreamFn takes no such param,
 * so this is carried as return metadata only — not yet wired into the
 * transport call.
 */
const MAX_TOKENS_DEFAULT = 1024

/**
 * Node types that touch the real provider/transcript in Live mode; everything
 * else (agents, supervisors, tools…) stays simulated even when Live is on.
 */
const LIVE_EXECUTED_TYPES: AgentFlowNodeType[] = [
  'start',
  'llm',
  'condition',
  'router',
  'guardrail',
  'evaluator',
  'join',
  'output',
  'httpRequest',
]

interface SimulationState {
  isActive: boolean
  isRunning: boolean
  currentNodeIndex: number
  executionQueue: string[]
  /** Queue entry currently executing (O(1) mirror of queue[currentNodeIndex]). */
  activeId: string | null
  /** Nodes that finished with status ok. */
  executedIds: Set<string>
  /** Nodes on condition branches that were not taken. */
  skippedNodeIds: Set<string>
  /** Which engine produced each executed node's output. */
  nodeEngines: Record<string, ExecutionEngine>
  liveMode: boolean
  userInput: string
  messages: ChatMessage[]
  nodeOutputs: Record<string, unknown>
  nodeStreams: Record<string, string>
  erroredNodeIds: string[]
  trace: TraceEntry[]
  /** T2-2: per-step state captures for the Time-Travel Debugger. */
  snapshots: StepSnapshot[]
  traceOpen: boolean
  /** Set when a Human-in-Loop node has executed and is awaiting approval. */
  pendingApproval: { nodeId: string } | null
  /** Try/Catch watch state, keyed by the TryCatch node's id. */
  tryCatchStatus: Record<string, 'watching' | 'success' | 'error'>
  /** Retry attempt counters, keyed by the Retry node's id. */
  retryStatus: Record<string, { attempt: number; max: number }>
  /** Hash of each cache-eligible node's resolved input from its last run. */
  nodeInputHashCache: Map<string, string>
  /** Clears the input-hash and output cache (called on stop() / full reset). */
  clearHashCache: () => void
  /** Records the resolved-input hash for a node after it runs. */
  setCachedHash: (nodeId: string, hash: string) => void
  setLiveMode: (on: boolean) => void
  setUserInput: (value: string) => void
  setTraceOpen: (open: boolean) => void
  clearTrace: () => void
  start: () => void
  stop: () => void
  play: () => void
  pause: () => void
  step: () => void
  restart: () => void
  /** Re-seed the run from a recorded step and resume execution from that node
   *  onward, reusing prior steps' outputs instead of re-running them. */
  forkFromSnapshot: (snapshots: StepSnapshot[], stepIndex: number) => void
  /** Resume past a Human-in-Loop gate. */
  approve: () => void
  /** Resume past a Human-in-Loop gate, injecting the user's typed response
   *  into the gate node's output before continuing. */
  submitHumanInput: (value: string) => void
  /** Reject at a Human-in-Loop gate: skip the downstream and end the run. */
  reject: () => void
}

// Invalidates in-flight run loops AND in-flight node executions whenever
// playback state changes; executeCurrent re-checks it after every await.
let runToken = 0
// Guards against re-entrant node execution (e.g. rapid Step clicks).
let stepInFlight = false
// Cancels the in-flight live LLM fetch on stop/pause/restart.
let abortController: AbortController | null = null
// Streamed chunks buffered between animation frames, so token-rate store
// writes collapse into at most one update per frame.
let streamBuffer: Record<string, string> = {}
let streamFlushFrame: number | null = null
// Times each node has been enqueued this run; bounds loop iterations.
let visitCounts = new Map<string, number>()
// Times each join has been deferred (re-queued waiting for branches); bounds
// the wait so an unreachable source can't livelock the run.
let joinDeferCounts = new Map<string, number>()

// Try/Catch: maps a guarded node id -> the TryCatch node guarding it, and the
// TryCatch node id -> the set of guarded node ids not yet completed.
let guardedByMap = new Map<string, string>()
let guardedRemaining = new Map<string, Set<string>>()
// Retry: maps the wrapped node id -> its Retry node id, and the Retry node id
// -> the current attempt number (1-based).
let retryWrapped = new Map<string, string>()
let retryAttempts = new Map<string, number>()

function clearFlowControlState() {
  guardedByMap = new Map()
  guardedRemaining = new Map()
  retryWrapped = new Map()
  retryAttempts = new Map()
}

/**
 * ── Map virtual-node expansion (per-item simulation) ─────────────────────
 * When a Map node executes, it expands its body (every flow node between it
 * and the downstream Join) into N parallel copies — one per item. Each copy
 * is a "virtual node" with id `<bodyId>__map_<i>`; it has no canvas presence
 * but is enqueued, executed, traced, and shows up in nodeOutputs like any
 * real node. The real body nodes are skip-marked so the join's CANVAS source
 * (the body terminal) counts as satisfied; the join then waits on the union
 * of canvas sources + virtual terminals via flowSources(joinId).
 *
 * Lifetimes: scoped to a run. Cleared by stop()/start()/restart().
 */
let virtualNodes = new Map<string, AgentFlowNode>()
let virtualSuccessors = new Map<string, string[]>()
let virtualJoinSources = new Map<string, Set<string>>()
let virtualParents = new Map<string, string>()
let virtualMeta = new Map<string, { item: string; index: number }>()

function clearVirtualState() {
  virtualNodes = new Map()
  virtualSuccessors = new Map()
  virtualJoinSources = new Map()
  virtualParents = new Map()
  virtualMeta = new Map()
}

// Node output caching: the real (untruncated) output of the last successful
// run for each cache-eligible node, keyed by node id. Paired with
// nodeInputHashCache (Zustand state) — a hit requires both the hash to match
// AND an entry to exist here (entries are only written after a real 'ok'
// completion, so "exists" already implies "last run succeeded").
let nodeOutputCache = new Map<string, unknown>()

/** Node types that never participate in output caching — see plan notes. */
const CACHE_INELIGIBLE_TYPES: AgentFlowNodeType[] = ['subgraph', 'map', 'humanInLoop']

function abortInFlight() {
  abortController?.abort()
  abortController = null
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/**
 * Like `delay`, but polls `runToken` so a Stop/Pause/Restart during the wait
 * (which bumps `runToken`) resolves immediately instead of after the full
 * duration.
 */
const abortableDelay = (ms: number, token: number): Promise<void> =>
  new Promise<void>((resolve) => {
    const deadline = Date.now() + ms
    const tick = () => {
      if (token !== runToken || Date.now() >= deadline) {
        resolve()
        return
      }
      window.setTimeout(tick, Math.min(50, deadline - Date.now()))
    }
    tick()
  })

/**
 * Entry points for the dynamic walker: Start nodes, else nodes with no
 * incoming flow edge, else (pure cycle) the topological head. The rest of
 * the run is discovered by following edges as nodes execute.
 */
function buildSeeds(): string[] {
  const { nodes, edges } = useCanvasStore.getState()
  const flowNodes = nodes.filter(
    (n) => n.type !== undefined && SIMULATED_TYPES.includes(n.type),
  )
  const ids = new Set(flowNodes.map((n) => n.id))
  const flowEdges = edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  )
  const starts = flowNodes.filter((n) => n.type === 'start').map((n) => n.id)
  if (starts.length > 0) return starts
  const hasIncoming = new Set(flowEdges.map((e) => e.target))
  const roots = flowNodes
    .filter((n) => !hasIncoming.has(n.id))
    .map((n) => n.id)
  if (roots.length > 0) return roots
  return topologicalSort(
    flowNodes.map((n) => n.id),
    flowEdges,
  ).slice(0, 1)
}

/** All node ids reachable by walking edges forward from `from` (inclusive). */
function reachableFrom(
  edges: { source: string; target: string }[],
  from: string,
): Set<string> {
  const seen = new Set<string>([from])
  const stack = [from]
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined) break
    for (const e of edges) {
      if (e.source === id && !seen.has(e.target)) {
        seen.add(e.target)
        stack.push(e.target)
      }
    }
  }
  return seen
}

function findNode(id: string): AgentFlowNode | undefined {
  const virtual = virtualNodes.get(id)
  if (virtual) return virtual
  return useCanvasStore.getState().nodes.find((n) => n.id === id)
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Inner-graph execution result returned by runSubgraph. */
interface SubgraphResult {
  output: Record<string, unknown>
  trace: TraceEntry[]
  stepCount: number
  error?: string
  /**
   * Fork of the parent transcript after the inner run (seed + any live/
   * simulated assistant turns appended inside the subgraph). The caller only
   * merges this back into the parent's `messages` when the Subgraph node's
   * `appendToParent` is enabled; otherwise it is discarded.
   */
  localMessages?: ChatMessage[]
}

/**
 * Resolve a condition's taken branch within an isolated subgraph: same logic
 * as resolveCondition in the parent walker, but scoped to the subgraph's own
 * edges/executed/skipped sets instead of canvas-wide state.
 */
function resolveSubgraphCondition(
  conditionId: string,
  taken: unknown,
  edges: AgentFlowEdge[],
  executedIds: ReadonlySet<string>,
  skippedIds: ReadonlySet<string>,
): { targets: string[]; skipped: Set<string>; newlySkipped: string[] } {
  const outs = edges.filter((e) => e.source === conditionId)
  const fallback = {
    targets: outs.map((e) => e.target),
    skipped: new Set(skippedIds),
    newlySkipped: [] as string[],
  }
  if (typeof taken !== 'string' || outs.length < 2) return fallback
  const takenEdge = outs.find(
    (e) =>
      (typeof e.label === 'string' && e.label !== '' ? e.label : e.target) === taken,
  )
  if (!takenEdge) return fallback
  const takenReach = reachableFrom(edges, takenEdge.target)
  const skipped = new Set([...skippedIds].filter((id) => !takenReach.has(id)))
  const newlySkipped: string[] = []
  for (const out of outs) {
    if (out === takenEdge) continue
    for (const id of reachableFrom(edges, out.target)) {
      if (takenReach.has(id) || id === conditionId) continue
      if (executedIds.has(id) || skipped.has(id)) continue
      skipped.add(id)
      newlySkipped.push(id)
    }
  }
  return { targets: [takenEdge.target], skipped, newlySkipped }
}

/**
 * Remap parent node outputs into the inner graph's input namespace.
 * `inputMapping` is JSON like '{"parentKey": "innerKey"}' — keys are looked
 * up against a one-level-flattened view of every parent node's output object
 * (e.g. a Start node's `{ inputs: { brief: "..." } }` exposes `brief`). The
 * inner state always carries `messages`, seeded from the parent transcript.
 */
function buildSubgraphInput(
  inputMapping: string | undefined,
  parentOutputs: Record<string, unknown>,
  messages: ChatMessage[],
): Record<string, unknown> {
  const flat: Record<string, unknown> = {}
  for (const value of Object.values(parentOutputs)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flat[k] = v
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) {
          if (!(ik in flat)) flat[ik] = iv
        }
      }
    }
  }
  const result: Record<string, unknown> = { messages: [...messages] }
  if (inputMapping) {
    try {
      const mapping = JSON.parse(inputMapping) as Record<string, string>
      for (const [parentKey, innerKey] of Object.entries(mapping)) {
        if (parentKey in flat) result[innerKey] = flat[parentKey]
      }
    } catch {
      // Invalid mapping JSON — the inner graph still gets `messages`.
    }
  }
  return result
}

/**
 * Remap inner-graph output back into the parent's namespace. `outputMapping`
 * is JSON like '{"innerKey": "parentKey"}'. The inner result's terminal
 * Output node (if any) is exposed at `innerOutput.output` by runSubgraph, so
 * a typical mapping is '{"output": "parentFieldName"}'.
 */
function mergeSubgraphOutput(
  innerOutput: Record<string, unknown>,
  outputMapping: string | undefined,
): Record<string, unknown> {
  if (!outputMapping) return innerOutput
  try {
    const mapping = JSON.parse(outputMapping) as Record<string, string>
    const result = { ...innerOutput }
    for (const [innerKey, parentKey] of Object.entries(mapping)) {
      if (innerKey in innerOutput) result[parentKey] = innerOutput[innerKey]
    }
    return result
  } catch {
    return innerOutput
  }
}

function resolveHttpTemplate(
  template: string,
  nodeOutputs: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in nodeOutputs ? String(nodeOutputs[key]) : `{{${key}}}`,
  )
}

export const useSimulationStore = create<SimulationState>((set, get) => {
  const finished = () =>
    get().currentNodeIndex >= get().executionQueue.length

  /**
   * Append a snapshot of the just-finished run to Run History. `evalRun`, if
   * provided, is the EvalRun produced for this run (so the qualityScore in
   * the snapshot matches this run, not a stale prior one).
   */
  const recordRunHistory = (
    status: 'done' | 'error' | 'stopped',
    costSummary: RunCostSummary,
    evalRun: EvalRun | null,
  ) => {
    const trace = get().trace
    if (trace.length === 0) return
    const elapsedMs = useSimulationMetricsStore.getState().elapsedMs
    const stepIndex = useSimulationMetricsStore.getState().stepIndex
    useRunHistoryStore.getState().addRun({
      id: crypto.randomUUID(),
      startedAt: Date.now() - elapsedMs,
      finishedAt: Date.now(),
      durationMs: elapsedMs,
      mode: get().liveMode ? 'live' : 'simulated',
      status,
      nodeCount: useCanvasStore.getState().nodes.length,
      stepCount: stepIndex,
      totalTokens: useSimulationMetricsStore.getState().tokens,
      totalCostUsd: costSummary.totalCostUsd,
      model: costSummary.model,
      qualityScore: evalRun?.qualityScore ?? null,
      evalPassCount: evalRun
        ? evalRun.results.filter((r) => r.status === 'pass').length
        : null,
      evalTotalCount: evalRun ? evalRun.results.length : null,
      traceSnapshot: structuredClone(trace),
      snapshots: structuredClone(get().snapshots),
      costSnapshot: structuredClone(costSummary),
    })
  }

  const finishRun = () => {
    const metrics = useSimulationMetricsStore.getState()
    metrics.pauseTimer()
    metrics.setActiveNodeCount(0)

    const trace = get().trace
    const messages = get().messages

    const costSummary = buildCostSummary(trace)
    metrics.setCostSummary(costSummary)

    const evalStore = useEvalStore.getState()
    let evalRun: EvalRun | null = null
    if (evalStore.testCases.length > 0) {
      const outputTrace = [...trace]
        .reverse()
        .find((e) => e.nodeType === 'output' && (e.status === 'ok' || e.status === 'cached'))
      const lastAssistant = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant')
      const actualOutput = outputTrace?.output ?? lastAssistant?.content ?? ''
      const results: EvalResult[] = evalStore.testCases.map((tc) =>
        scoreTestCase(tc, actualOutput),
      )
      evalRun = {
        id: crypto.randomUUID(),
        runAt: Date.now(),
        results,
        qualityScore: computeQualityScore(results),
      }
      evalStore.addRun(evalRun)
    }

    recordRunHistory(get().erroredNodeIds.length > 0 ? 'error' : 'done', costSummary, evalRun)

    // Record a lightweight run summary for the read-only "Last run" row.
    // Skipped trace entries are branches that never ran, so they're excluded
    // from the executed-node count.
    evalStore.recordRunSummary({
      runId: crypto.randomUUID(),
      timestamp: Date.now(),
      nodesExecuted: trace.filter((e) => e.status !== 'skipped').length,
      errorCount: get().erroredNodeIds.length,
      totalLatencyMs: useSimulationMetricsStore.getState().elapsedMs,
    })

    set({ isRunning: false })
  }

  const buildCostSummary = (trace: TraceEntry[]): RunCostSummary => {
    const COSTED_TYPES = new Set([
      'llm',
      'agent',
      'router',
      'guardrail',
      'evaluator',
      'supervisor',
      'swarmWorker',
    ])
    const { activeProvider, settings } = useLLMConfigStore.getState()
    const globalModel = settings[activeProvider]?.model ?? ''

    const nodesById = new Map<string, AgentFlowNode>()
    for (const n of useCanvasStore.getState().nodes) nodesById.set(n.id, n)

    const entries: NodeCostEntry[] = []
    let resolvedModel = globalModel
    for (const t of trace) {
      if (!COSTED_TYPES.has(t.nodeType)) continue
      if (t.status !== 'ok') continue
      const node = nodesById.get(t.nodeId)
      const nodeModel =
        node?.data.modelOverride && node.data.modelOverride.trim() !== ''
          ? node.data.modelOverride
          : (node?.data.model && node.data.model.trim() !== ''
              ? node.data.model
              : globalModel)
      if (nodeModel && nodeModel.trim() !== '') resolvedModel = nodeModel
      const inTokens = estimateTokens(t.input)
      const outTokens = estimateTokens(t.output)
      const total = inTokens + outTokens
      const tokensIn = Math.round(total * 0.7)
      const tokensOut = total - tokensIn
      const pricing = getPricing(nodeModel || globalModel)
      const costUsd =
        (tokensIn / 1_000_000) * pricing.inputPer1M +
        (tokensOut / 1_000_000) * pricing.outputPer1M
      entries.push({
        nodeId: t.nodeId,
        nodeName: t.nodeName,
        nodeType: t.nodeType,
        tokensIn,
        tokensOut,
        estimatedCostUsd: costUsd,
      })
    }
    return {
      entries,
      totalTokens: entries.reduce(
        (s, e) => s + e.tokensIn + e.tokensOut,
        0,
      ),
      totalCostUsd: entries.reduce((s, e) => s + e.estimatedCostUsd, 0),
      model: resolvedModel,
    }
  }

  const flushStreams = () => {
    if (streamFlushFrame !== null) {
      window.cancelAnimationFrame(streamFlushFrame)
      streamFlushFrame = null
    }
    const buffered = Object.entries(streamBuffer)
    if (buffered.length === 0) return
    streamBuffer = {}
    const nodeStreams = { ...get().nodeStreams }
    for (const [id, text] of buffered) {
      nodeStreams[id] = (nodeStreams[id] ?? '') + text
    }
    set({ nodeStreams })
  }

  const discardPendingStreams = () => {
    if (streamFlushFrame !== null) {
      window.cancelAnimationFrame(streamFlushFrame)
      streamFlushFrame = null
    }
    streamBuffer = {}
  }

  const appendStream = (nodeId: string, chunk: string) => {
    streamBuffer[nodeId] = (streamBuffer[nodeId] ?? '') + chunk
    streamFlushFrame ??= window.requestAnimationFrame(flushStreams)
  }

  /** Ids of nodes that participate in the simulated flow. */
  const flowNodeIds = (): Set<string> =>
    new Set(
      useCanvasStore
        .getState()
        .nodes.filter(
          (n) => n.type !== undefined && SIMULATED_TYPES.includes(n.type),
        )
        .map((n) => n.id),
    )

  /**
   * Flow-node successors of a node (what the walker enqueues next). For
   * virtual nodes (Map per-item branches), edges live in the virtualSuccessors
   * sidecar; the canvas has no record of them.
   */
  const flowTargets = (nodeId: string): string[] => {
    if (virtualNodes.has(nodeId)) {
      return virtualSuccessors.get(nodeId) ?? []
    }
    const ids = flowNodeIds()
    return useCanvasStore
      .getState()
      .edges.filter((e) => e.source === nodeId && ids.has(e.target))
      .map((e) => e.target)
  }

  /**
   * Flow-node predecessors of a node (the branches a join waits on). Joins
   * also pick up their Map's virtual terminal branches via virtualJoinSources,
   * unioned with the canvas sources, so joinReadiness waits for every per-item
   * branch to complete.
   */
  const flowSources = (nodeId: string): string[] => {
    const ids = flowNodeIds()
    const canvas = useCanvasStore
      .getState()
      .edges.filter((e) => e.target === nodeId && ids.has(e.source))
      .map((e) => e.source)
    const virtual = virtualJoinSources.get(nodeId)
    return virtual ? [...canvas, ...virtual] : canvas
  }

  /**
   * Approximates "this node's input" for cache-hash purposes: its own
   * config plus every upstream node's current output, plus the run-level
   * knobs (userInput, liveMode) that can change a node's output without
   * changing its own data. Pure read — no side effects.
   */
  const resolveCacheInput = (nodeId: string, node: AgentFlowNode): unknown => {
    const outputs = get().nodeOutputs
    const upstream = flowSources(nodeId)
      .slice()
      .sort()
      .map((id) => ({ id, output: outputs[id] }))
    return {
      data: node.data,
      upstream,
      userInput: get().userInput,
      liveMode: get().liveMode,
    }
  }

  /**
   * Resolve a condition's taken branch from its configured predicates against
   * the latest content. Shared by the simulated and live engines so both
   * behave identically. The node's final allowed visit forces the else branch
   * so cycles terminate regardless of what the content says.
   */
  const conditionOutput = (
    nodeId: string,
    branches: string[] | undefined,
    content: string,
  ): { evaluated: string[]; taken: string; matched: boolean; forced_else: boolean } => {
    const list = branches ?? []
    const forceElse = (visitCounts.get(nodeId) ?? 1) >= MAX_NODE_VISITS
    const decision = evaluateConditionBranches(list, content, forceElse)
    return {
      evaluated: list,
      taken: decision.taken,
      matched: decision.matched,
      forced_else: forceElse,
    }
  }

  /** Most recent transcript content, falling back to the user input. */
  const latestContent = (): string => {
    const last = [...get().messages].reverse()[0]
    return last?.content ?? get().userInput
  }

  /** Merge the outputs of a join's executed sources (skipped ones excluded). */
  const mergeJoinForNode = (
    nodeId: string,
    strategy: 'concat' | 'last',
  ): ReturnType<typeof mergeJoinInputs> => {
    const executed = get().executedIds
    const outputs = get().nodeOutputs
    const inputs = flowSources(nodeId)
      .filter((s) => executed.has(s))
      .map((s) => ({ source: s, output: outputs[s] }))
    return mergeJoinInputs(inputs, strategy)
  }

  /**
   * Append targets to the queue unless they're skip-marked, already pending,
   * or out of visit budget. Increments the per-node visit count for each
   * accepted target.
   */
  const enqueueTargets = (
    queue: string[],
    pendingFrom: number,
    skipped: Set<string>,
    targets: string[],
  ): string[] => {
    const next = [...queue]
    for (const target of targets) {
      if (skipped.has(target)) continue
      if ((visitCounts.get(target) ?? 0) >= MAX_NODE_VISITS) continue
      if (next.slice(pendingFrom).includes(target)) continue
      visitCounts.set(target, (visitCounts.get(target) ?? 0) + 1)
      next.push(target)
    }
    return next
  }

  /**
   * Resolve which edge a condition took: only that target continues, and
   * nodes reachable solely via non-taken branches are skip-marked. Nodes
   * also reachable from the taken branch (joins), already executed (loop
   * back-edges), or the condition itself are left alone. Previously skipped
   * nodes that the taken path needs are un-skipped. When the taken value
   * can't be matched to an edge, all targets continue (fan behavior).
   */
  const resolveCondition = (
    conditionId: string,
    taken: unknown,
  ): { targets: string[]; skipped: Set<string>; newlySkipped: string[] } => {
    const fallback = {
      targets: flowTargets(conditionId),
      skipped: get().skippedNodeIds,
      newlySkipped: [] as string[],
    }
    if (typeof taken !== 'string') return fallback
    const { edges } = useCanvasStore.getState()
    const outs = edges.filter((e) => e.source === conditionId)
    if (outs.length < 2) return fallback
    const takenEdge = outs.find(
      (e) =>
        (typeof e.label === 'string' && e.label !== ''
          ? e.label
          : e.target) === taken,
    )
    if (!takenEdge) return fallback
    const takenReach = reachableFrom(edges, takenEdge.target)
    const { executedIds, skippedNodeIds } = get()
    const skipped = new Set(
      [...skippedNodeIds].filter((id) => !takenReach.has(id)),
    )
    const newlySkipped: string[] = []
    for (const out of outs) {
      if (out === takenEdge) continue
      for (const id of reachableFrom(edges, out.target)) {
        if (takenReach.has(id) || id === conditionId) continue
        if (executedIds.has(id) || skipped.has(id)) continue
        skipped.add(id)
        newlySkipped.push(id)
      }
    }
    return {
      targets: flowNodeIds().has(takenEdge.target) ? [takenEdge.target] : [],
      skipped,
      newlySkipped,
    }
  }

  /**
   * Dynamic scheduling step: given the node that just finished and its output,
   * decide which nodes run next and how the pending queue grows. This is the
   * heart of the dynamic walker — successors are discovered HERE, after the
   * current node runs, never prebuilt. Routing nodes contribute only their
   * taken edge (the rest are skip-marked + traced via resolveCondition); every
   * other node fans out to all flow targets. Returns the advanced index, the
   * grown-and-pruned queue, the updated skip set, and the skipped-branch trace
   * entries the caller records alongside the node's own entry.
   */
  const scheduleNextNodes = (
    node: AgentFlowNode,
    nodeId: string,
    output: unknown,
  ): {
    nextIndex: number
    nextQueue: string[]
    skipped: Set<string>
    skipEntries: TraceEntry[]
  } => {
    let skipped = get().skippedNodeIds
    let nextTargets: string[]
    const skipEntries: TraceEntry[] = []
    if (isRoutingType(node.type)) {
      const taken = (output as { taken?: unknown } | null)?.taken
      const resolution = resolveCondition(nodeId, taken)
      skipped = resolution.skipped
      nextTargets = resolution.targets
      for (const skippedId of resolution.newlySkipped) {
        const skippedNode = findNode(skippedId)
        if (!skippedNode) continue
        skipEntries.push({
          id: crypto.randomUUID(),
          at: Date.now(),
          nodeId: skippedId,
          nodeName: skippedNode.data.label,
          nodeType: skippedNode.type ?? 'unknown',
          status: 'skipped',
          durationMs: 0,
          input: '—',
          output: 'branch not taken',
        })
      }
    } else {
      nextTargets = flowTargets(nodeId)
    }

    const nextIndex = get().currentNodeIndex + 1
    const grown = enqueueTargets(
      get().executionQueue,
      nextIndex,
      skipped,
      nextTargets,
    )
    // Drop freshly skip-marked nodes from the pending part of the queue.
    const nextQueue = [
      ...grown.slice(0, nextIndex),
      ...grown.slice(nextIndex).filter((id) => !skipped.has(id)),
    ]
    return { nextIndex, nextQueue, skipped, skipEntries }
  }

  /**
   * Find the first Join node reachable forward from a Map node. Returns
   * undefined if no Join exists downstream (then Map falls back to the
   * original single-step fan animation, no virtual expansion).
   */
  const findDownstreamJoin = (mapId: string): string | undefined => {
    const { edges, nodes } = useCanvasStore.getState()
    const ids = flowNodeIds()
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const visited = new Set<string>([mapId])
    const queue = edges
      .filter((e) => e.source === mapId && ids.has(e.target))
      .map((e) => e.target)
    while (queue.length > 0) {
      const cur = queue.shift()
      if (cur === undefined || visited.has(cur)) continue
      visited.add(cur)
      if (nodeById.get(cur)?.type === 'join') return cur
      for (const e of edges) {
        if (e.source === cur && ids.has(e.target) && !visited.has(e.target)) {
          queue.push(e.target)
        }
      }
    }
    return undefined
  }

  /** All real flow nodes strictly between Map and Join (exclusive both ends). */
  const findBodyNodes = (mapId: string, joinId: string): Set<string> => {
    const { edges } = useCanvasStore.getState()
    const ids = flowNodeIds()
    const body = new Set<string>()
    const queue = edges
      .filter(
        (e) => e.source === mapId && ids.has(e.target) && e.target !== joinId,
      )
      .map((e) => e.target)
    while (queue.length > 0) {
      const cur = queue.shift()
      if (cur === undefined || cur === joinId || body.has(cur)) continue
      body.add(cur)
      for (const e of edges) {
        if (
          e.source === cur &&
          ids.has(e.target) &&
          e.target !== joinId &&
          !body.has(e.target)
        ) {
          queue.push(e.target)
        }
      }
    }
    return body
  }

  /**
   * Resolve a TryCatch node's onSuccess/onError targets and the set of nodes
   * "guarded" by it: everything reachable from the onSuccess edge, stopping
   * at (and including) the first Join. Mirrors findDownstreamJoin/
   * findBodyNodes but for the onSuccess-labeled branch specifically.
   */
  const findGuardedNodes = (
    tryCatchId: string,
  ): { onSuccessTarget?: string; onErrorTarget?: string; guarded: Set<string> } => {
    const { edges } = useCanvasStore.getState()
    const ids = flowNodeIds()
    const outs = edges.filter((e) => e.source === tryCatchId && ids.has(e.target))
    const onSuccessEdge = outs.find((e) => e.label === 'onSuccess')
    const onErrorEdge = outs.find((e) => e.label === 'onError')
    const guarded = new Set<string>()
    if (onSuccessEdge) {
      const queue = [onSuccessEdge.target]
      while (queue.length > 0) {
        const cur = queue.shift()
        if (cur === undefined || guarded.has(cur) || cur === tryCatchId) continue
        guarded.add(cur)
        // JOIN BARRIER GUARD: confirmed
        if (findNode(cur)?.type === 'join') continue
        for (const e of edges) {
          if (e.source === cur && ids.has(e.target) && !guarded.has(e.target)) {
            queue.push(e.target)
          }
        }
      }
    }
    return { onSuccessTarget: onSuccessEdge?.target, onErrorTarget: onErrorEdge?.target, guarded }
  }

  /**
   * Called once a guarded node finishes ok and is removed from its TryCatch's
   * remaining set. If that was the last one, the success path is confirmed:
   * mark the TryCatch 'success' and skip-mark the onError branch (it was the
   * road not taken).
   */
  const checkGuardSuccess = (
    tryCatchId: string,
    skipped: Set<string>,
  ): { skipped: Set<string>; skipEntries: TraceEntry[]; success: boolean } => {
    const remaining = guardedRemaining.get(tryCatchId)
    if (!remaining || remaining.size > 0) {
      return { skipped, skipEntries: [], success: false }
    }
    const { onErrorTarget } = findGuardedNodes(tryCatchId)
    if (!onErrorTarget) return { skipped, skipEntries: [], success: true }
    const newSkipped = new Set(skipped)
    const skipEntries: TraceEntry[] = []
    for (const id of reachableFrom(useCanvasStore.getState().edges, onErrorTarget)) {
      if (id === tryCatchId || newSkipped.has(id) || get().executedIds.has(id)) continue
      newSkipped.add(id)
      const n = findNode(id)
      if (!n) continue
      skipEntries.push({
        id: crypto.randomUUID(),
        at: Date.now(),
        nodeId: id,
        nodeName: n.data.label,
        nodeType: n.type ?? 'unknown',
        status: 'skipped',
        durationMs: 0,
        input: '—',
        output: 'onError branch not taken',
      })
    }
    return { skipped: newSkipped, skipEntries, success: true }
  }

  /**
   * If `nodeId` is wrapped by a Retry node and its config covers `cause`,
   * advance the attempt counter and wait out the backoff. Returns 'retried'
   * (caller should re-run the same node — return without advancing the
   * queue), 'exhausted' (caller should record the error and halt), or 'none'
   * (not wrapped / not configured for this cause — caller proceeds as usual).
   */
  const maybeRetry = async (
    nodeId: string,
    token: number,
    cause: 'error' | 'empty_output',
  ): Promise<'retried' | 'exhausted' | 'none'> => {
    const retryId = retryWrapped.get(nodeId)
    if (!retryId) return 'none'
    const cfg = findNode(retryId)?.data.retry
    if (!cfg) return 'none'
    if (!cfg.retryOn.includes(cause) && !cfg.retryOn.includes('any')) return 'none'
    const attempt = retryAttempts.get(retryId) ?? 1
    if (attempt >= cfg.maxAttempts) return 'exhausted'
    retryAttempts.set(retryId, attempt + 1)
    set({
      retryStatus: {
        ...get().retryStatus,
        [retryId]: { attempt: attempt + 1, max: cfg.maxAttempts },
      },
    })
    const backoff = cfg.backoffMs * Math.pow(cfg.backoffMultiplier, attempt - 1)
    // ABORT GUARD: resolve early if Stop/Pause/Restart bumps runToken mid-wait,
    // instead of always waiting out the full backoff.
    await abortableDelay(backoff, token)
    return 'retried'
  }

  /**
   * Expand a Map node into per-item virtual branches. Populates virtualNodes,
   * virtualSuccessors, virtualJoinSources, virtualParents, virtualMeta. Returns
   * the entry virtual ids to enqueue, the real body ids to skip-mark, the
   * resolved item list, and the join id. Returns null when no downstream join
   * was found (caller falls back to the legacy single-step fan).
   */
  const expandMap = (
    mapNode: AgentFlowNode,
    mapId: string,
  ): {
    items: string[]
    entryVids: string[]
    bodyIds: Set<string>
    joinId: string
  } | null => {
    const joinId = findDownstreamJoin(mapId)
    if (!joinId) return null
    const body = findBodyNodes(mapId, joinId)
    if (body.size === 0) return null

    const configured = (mapNode.data.mapItems ?? []).filter(
      (s) => s.trim() !== '',
    )
    const items =
      configured.length > 0
        ? configured
        : Array.from(
            { length: Math.max(1, mapNode.data.mapCount ?? 3) },
            (_, i) => `item_${i + 1}`,
          )

    const { edges } = useCanvasStore.getState()
    const bodyEntries = edges
      .filter((e) => e.source === mapId && body.has(e.target))
      .map((e) => e.target)
    const bodyTerminals = new Set(
      edges
        .filter((e) => body.has(e.source) && e.target === joinId)
        .map((e) => e.source),
    )

    const entryVids: string[] = []
    const joinSources =
      virtualJoinSources.get(joinId) ?? new Set<string>()

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      for (const bId of body) {
        const real = findNode(bId)
        if (!real) continue
        const vid = `${bId}__map_${i}`
        const synth: AgentFlowNode = {
          ...real,
          id: vid,
          data: { ...real.data, label: `${real.data.label} [item ${item}]` },
        }
        virtualNodes.set(vid, synth)
        virtualParents.set(vid, mapId)
        virtualMeta.set(vid, { item, index: i })
      }
      for (const e of edges) {
        if (!body.has(e.source)) continue
        if (body.has(e.target)) {
          const sv = `${e.source}__map_${i}`
          const tv = `${e.target}__map_${i}`
          const prev = virtualSuccessors.get(sv) ?? []
          virtualSuccessors.set(sv, [...prev, tv])
        }
      }
      for (const t of bodyTerminals) joinSources.add(`${t}__map_${i}`)
      for (const b of bodyEntries) entryVids.push(`${b}__map_${i}`)
    }
    virtualJoinSources.set(joinId, joinSources)
    return { items, entryVids, bodyIds: body, joinId }
  }

  /**
   * Live-mode execution: LLM nodes call the configured provider for real;
   * tool-like nodes run stubs (real tool execution is Phase 2); condition
   * nodes evaluate against the actual response content.
   */
  const executeLiveNode = async (
    node: AgentFlowNode,
    nodeId: string,
  ): Promise<unknown> => {
    const metrics = useSimulationMetricsStore.getState()
    switch (node.type) {
      case 'start': {
        const content = get().userInput.trim() || 'Hello!'
        set({ messages: [{ role: 'user', content }] })
        await delay(400)
        return { inputs: { message: content } }
      }
      case 'llm': {
        const base = useLLMConfigStore.getState().getConfig()
        // Per-node override: a non-empty value replaces the global model for
        // this node only; the provider/transport stays the global one.
        const override = (node.data.modelOverride ?? '').trim()
        const config =
          override === ''
            ? base
            : { ...base, settings: { ...base.settings, model: override } }
        const { systemPrompt } = resolveNodePrompts(node.data)
        const chat: ChatMessage[] = [
          {
            role: 'system',
            content: systemPrompt || 'You are a helpful assistant.',
          },
          ...get().messages,
        ]
        set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
        abortController?.abort()
        abortController = new AbortController()
        const full = await streamChat(
          withMaxTokens(config, node.data.maxTokens),
          chat,
          (chunk) => appendStream(nodeId, chunk),
          abortController.signal,
        )
        flushStreams()
        set({
          messages: [...get().messages, { role: 'assistant', content: full }],
        })
        metrics.addTokens(estimateTokens(full))
        return {
          role: 'assistant',
          content: truncate(full, 400),
          model: node.data.model ?? '—',
          temperature: node.data.temperature ?? 0.7,
          maxTokens: node.data.maxTokens ?? MAX_TOKENS_DEFAULT,
        }
      }
      case 'tool':
      case 'retriever': {
        // Tool/retriever nodes call the real provider in Live mode, mirroring
        // the default: branch's agent pattern. Falls back to a toast +
        // { error } on failure so a single bad call can't crash the run.
        try {
          const base = useLLMConfigStore.getState().getConfig()
          const explicitModel =
            (node.data.model ?? '').trim() || (node.data.modelOverride ?? '').trim()
          const config =
            explicitModel === '' || explicitModel === base.settings.model
              ? base
              : { ...base, settings: { ...base.settings, model: explicitModel } }
          const { systemPrompt: resolvedPrompt } = resolveNodePrompts(node.data)
          const systemPrompt =
            resolvedPrompt || `You are a ${node.type} agent. Complete your task.`
          const temperature = node.data.temperature ?? 0.7
          const chat: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...get().messages,
          ]
          set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
          abortController?.abort()
          abortController = new AbortController()
          const full = await streamChat(
            withMaxTokens(config, node.data.maxTokens),
            chat,
            (chunk) => appendStream(nodeId, chunk),
            abortController.signal,
          )
          flushStreams()
          set({
            messages: [...get().messages, { role: 'assistant', content: full }],
          })
          metrics.addTokens(estimateTokens(full))
          return {
            role: 'assistant',
            content: truncate(full, 400),
            model: config.settings.model,
            temperature,
            maxTokens: node.data.maxTokens ?? MAX_TOKENS_DEFAULT,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          useToastStore.getState().pushToast(`${node.data.label}: ${message}`, 'warning')
          return { error: message }
        }
      }
      case 'mcpServer': {
        // Parse a tool-call request out of the upstream LLM node's output. If
        // there isn't one, pass the transcript through unchanged.
        const inputContent = latestContent()
        const toolCall = parseToolCall(inputContent)
        if (!toolCall) {
          return { output: inputContent, status: 'done' }
        }

        const { selectedTools } = node.data
        if (selectedTools?.length && !selectedTools.includes(toolCall.name)) {
          const output = { output: `Tool "${toolCall.name}" is not enabled on this node.`, status: 'error' }
          appendStream(nodeId, JSON.stringify(output, null, 2))
          return output
        }

        const signal = abortController?.signal
        if (signal?.aborted) return { output: '', status: 'error' }
        const result = await callTool(
          node.data.serverUrl ?? '',
          node.data.authToken,
          toolCall.name,
          toolCall.input,
          signal,
        )
        const output = { output: JSON.stringify(result, null, 2), status: 'done' }
        appendStream(nodeId, output.output)
        set({
          messages: [...get().messages, { role: 'user', content: output.output }],
        })
        metrics.addTokens(estimateTokens(output.output))
        return output
      }
      case 'longTermStore': {
        // Session-scoped store (memoryStore) — 'write' persists the latest
        // transcript content under `namespace`; 'read'/'search' pull entries
        // back and surface them to downstream nodes as a user message so the
        // next live LLM call actually sees them.
        const namespace = (node.data.namespace ?? 'default').trim() || 'default'
        const operation = node.data.storeOperation ?? 'read'
        if (operation === 'write') {
          const content = latestContent()
          useMemoryStore.getState().write(namespace, content)
          return { namespace, operation, wrote: content }
        }
        const all = useMemoryStore.getState().read(namespace)
        const query = (node.data.searchQuery ?? '').trim().toLowerCase()
        const results =
          operation === 'search' && query
            ? all.filter((entry) => entry.toLowerCase().includes(query))
            : all
        if (results.length > 0) {
          const summary = `[${node.data.label}] retrieved from "${namespace}":\n${results.join('\n')}`
          set({ messages: [...get().messages, { role: 'user', content: summary }] })
        }
        return { namespace, operation, results }
      }
      case 'memoryWriter': {
        // LangMem-style background extractor, simplified to a direct write —
        // no separate extraction LLM call.
        const namespace = (node.data.writeNamespace ?? 'default').trim() || 'default'
        const content = latestContent()
        useMemoryStore.getState().write(namespace, content)
        return {
          namespace,
          memoryKind: node.data.memoryKind ?? 'episodic',
          wrote: content,
        }
      }
      case 'httpRequest': {
        const token = runToken
        const nodeOutputs = get().nodeOutputs
        const url = resolveHttpTemplate(node.data.httpUrl ?? '', nodeOutputs)
        const method = node.data.httpMethod ?? 'GET'
        const timeoutMs = node.data.httpTimeoutMs ?? 10000

        let headers: Record<string, string> = {}
        try {
          headers = JSON.parse(node.data.httpHeaders ?? '{}')
        } catch {
          // ignore malformed JSON headers
        }

        let body: string | undefined
        if (['POST', 'PUT', 'PATCH'].includes(method) && node.data.httpBody) {
          body = node.data.httpBody
          headers['Content-Type'] ??= 'application/json'
        }

        abortController?.abort()
        abortController = new AbortController()
        const localController = abortController
        const timeoutId = setTimeout(() => localController.abort(), timeoutMs)

        let resp: Response
        try {
          resp = await fetch(url, {
            method,
            headers,
            body,
            signal: localController.signal,
          })
        } finally {
          clearTimeout(timeoutId)
        }

        if (token !== runToken) return undefined
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)

        const contentType = resp.headers.get('content-type') ?? ''
        const text = contentType.includes('application/json')
          ? JSON.stringify(await resp.json())
          : await resp.text()

        if (token !== runToken) return undefined

        appendStream(nodeId, text)
        return { url, method, status: resp.status, output: text }
      }
      case 'condition': {
        // Same predicate evaluation as the simulated engine, against the real
        // transcript content.
        await delay(400)
        return conditionOutput(nodeId, node.data.branches, latestContent())
      }
      case 'router': {
        const routes = (node.data.routes ?? []).filter(Boolean)
        if (routes.length === 0) return { taken: 'default', matched_on: null }
        const base = useLLMConfigStore.getState().getConfig()
        const override = (node.data.modelOverride ?? '').trim()
        const config =
          override === ''
            ? base
            : { ...base, settings: { ...base.settings, model: override } }
        const chat: ChatMessage[] = [
          {
            role: 'system',
            content: `${node.data.routingPrompt ?? 'Classify the request.'}\nRespond with exactly one of: ${routes.join(', ')}. Reply with the route name only.`,
          },
          ...get().messages,
        ]
        set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
        abortController?.abort()
        abortController = new AbortController()
        const reply = await streamChat(
          withMaxTokens(config, node.data.maxTokens),
          chat,
          (chunk) => appendStream(nodeId, chunk),
          abortController.signal,
        )
        flushStreams()
        metrics.addTokens(estimateTokens(reply))
        // Match the model's reply to a route (models often add prose);
        // fall back to the first route so a path is always taken.
        const lower = reply.toLowerCase()
        const matched = routes.find((r) => lower.includes(r.toLowerCase()))
        return {
          taken: matched ?? routes[0],
          matched_on: matched ?? null,
          reply: truncate(reply, 120),
        }
      }
      case 'guardrail': {
        const last = [...get().messages].reverse()[0]
        const content = last?.content ?? get().userInput
        if ((node.data.checkType ?? 'keyword') === 'keyword') {
          // Deterministic check — honest to run locally even in Live mode.
          const decision = evaluateKeywordGuardrail(
            node.data.criteria ?? '',
            content,
          )
          await delay(400)
          return { taken: decision.taken, matched: decision.matched }
        }
        // llm-judge: one real pass/fail classification call.
        const base = useLLMConfigStore.getState().getConfig()
        const override = (node.data.modelOverride ?? '').trim()
        const config =
          override === ''
            ? base
            : { ...base, settings: { ...base.settings, model: override } }
        const chat: ChatMessage[] = [
          {
            role: 'system',
            content: `${node.data.criteria ?? 'Judge whether the response is acceptable.'}\nReply with exactly PASS or FAIL.`,
          },
          ...get().messages,
        ]
        set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
        abortController?.abort()
        abortController = new AbortController()
        const reply = await streamChat(
          withMaxTokens(config, node.data.maxTokens),
          chat,
          (chunk) => appendStream(nodeId, chunk),
          abortController.signal,
        )
        flushStreams()
        metrics.addTokens(estimateTokens(reply))
        const taken = reply.toLowerCase().includes('fail') ? 'fail' : 'pass'
        return { taken, verdict: truncate(reply, 80) }
      }
      case 'evaluator': {
        const branches = (node.data.evalBranches ?? ['pass', 'fail']).filter(
          Boolean,
        )
        if (branches.length === 0) {
          await delay(400)
          return { taken: 'pass', note: 'no branches configured' }
        }
        const base = useLLMConfigStore.getState().getConfig()
        const override = (node.data.modelOverride ?? '').trim()
        const config =
          override === ''
            ? base
            : { ...base, settings: { ...base.settings, model: override } }
        const rubric = node.data.scoringPrompt ?? 'Score the response.'
        const chat: ChatMessage[] = [
          {
            role: 'system',
            content: `${rubric}\nReply with exactly one of: ${branches.join(', ')}. Reply with the branch name only.`,
          },
          ...get().messages,
        ]
        set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
        abortController?.abort()
        abortController = new AbortController()
        const reply = await streamChat(
          withMaxTokens(config, node.data.maxTokens),
          chat,
          (chunk) => appendStream(nodeId, chunk),
          abortController.signal,
        )
        flushStreams()
        metrics.addTokens(estimateTokens(reply))
        const lower = reply.toLowerCase()
        const matched = branches.find((b) => lower.includes(b.toLowerCase()))
        // Final allowed visit forces the else (last branch) so loops end.
        const forceElse = (visitCounts.get(nodeId) ?? 1) >= MAX_NODE_VISITS
        const taken = forceElse
          ? branches[branches.length - 1]
          : (matched ?? branches[branches.length - 1])
        return {
          score_type: node.data.scoreType ?? 'pass_fail',
          evaluated: branches,
          taken,
          matched: !forceElse && matched !== undefined,
          forced_else: forceElse,
          verdict: truncate(reply, 120),
        }
      }
      case 'join': {
        // Deterministic merge — identical to the simulated engine. A summary
        // message is appended so downstream LLM calls see the joined context.
        const merged = mergeJoinForNode(
          nodeId,
          node.data.mergeStrategy ?? 'concat',
        )
        const summary = `[${node.data.label}] merged ${merged.waited_for} branch result(s)`
        appendStream(nodeId, JSON.stringify(merged.merged, null, 2))
        set({
          messages: [...get().messages, { role: 'user', content: summary }],
        })
        await delay(400)
        return merged
      }
      case 'output': {
        const lastAssistant = [...get().messages]
          .reverse()
          .find((m) => m.role === 'assistant')
        await delay(300)
        return { final_reply: truncate(lastAssistant?.content ?? '', 400) }
      }
      default: {
        // Agents, supervisors, loops etc. call the real provider in Live
        // mode, mirroring the 'llm' case with a role-flavored fallback
        // system prompt. Falls back to a toast + { error } on failure so a
        // single bad call can't crash the run.
        try {
          const base = useLLMConfigStore.getState().getConfig()
          const explicitModel =
            (node.data.model ?? '').trim() || (node.data.modelOverride ?? '').trim()
          const config =
            explicitModel === '' || explicitModel === base.settings.model
              ? base
              : { ...base, settings: { ...base.settings, model: explicitModel } }
          const { systemPrompt: resolvedPrompt } = resolveNodePrompts(node.data)
          const systemPrompt =
            resolvedPrompt || `You are a ${node.type} agent. Complete your task.`
          const temperature = node.data.temperature ?? 0.7
          const chat: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...get().messages,
          ]
          set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
          abortController?.abort()
          abortController = new AbortController()
          const full = await streamChat(
            withMaxTokens(config, node.data.maxTokens),
            chat,
            (chunk) => appendStream(nodeId, chunk),
            abortController.signal,
          )
          flushStreams()
          set({
            messages: [...get().messages, { role: 'assistant', content: full }],
          })
          metrics.addTokens(estimateTokens(full))
          return {
            role: 'assistant',
            content: truncate(full, 400),
            model: config.settings.model,
            temperature,
            maxTokens: node.data.maxTokens ?? MAX_TOKENS_DEFAULT,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          useToastStore.getState().pushToast(`${node.data.label}: ${message}`, 'warning')
          return { error: message }
        }
      }
    }
  }

  /**
   * Isolated sub-walker for a Subgraph node's inner graph. Mirrors the parent
   * walker's queue/visit/skip/join semantics on its own copies of that state —
   * the parent's executionQueue, visitCounts, nodeOutputs etc. are never read
   * or mutated. `localMessages` starts as a fork of the parent transcript
   * (seeded by buildSubgraphInput via inputState.messages); it is only merged
   * back into the parent's `messages` by the caller when the Subgraph node's
   * `appendToParent` is enabled.
   *
   * When `liveMode` is true, inner nodes whose type is in LIVE_EXECUTED_TYPES
   * make real provider calls — reusing the SAME module-level abortController
   * as the parent walker, so Stop/Pause aborts an in-flight inner call too.
   * Every other inner node type stays simulated via fakeOutputFor/the pure
   * flowSemantics helpers, exactly as in the non-live path. Aborts if
   * `parentRunToken` no longer matches the module-level `runToken` (the parent
   * run was stopped/paused/restarted while this was in flight) — checked
   * after every await, live or simulated.
   */
  const runSubgraph = async (
    subgraphNodes: AgentFlowNode[],
    subgraphEdges: AgentFlowEdge[],
    inputState: Record<string, unknown>,
    parentRunToken: number,
    parentNodeId: string,
    liveMode: boolean,
  ): Promise<SubgraphResult> => {
    if (subgraphNodes.length === 0) {
      return { output: {}, trace: [], stepCount: 0 }
    }

    const metrics = useSimulationMetricsStore.getState()
    const ids = new Set(subgraphNodes.map((n) => n.id))
    const edges = subgraphEdges.filter((e) => ids.has(e.source) && ids.has(e.target))
    const nodeById = new Map(subgraphNodes.map((n) => [n.id, n]))
    const targets = (nodeId: string) =>
      edges.filter((e) => e.source === nodeId).map((e) => e.target)
    const sources = (nodeId: string) =>
      edges.filter((e) => e.target === nodeId).map((e) => e.source)

    const hasIncoming = new Set(edges.map((e) => e.target))
    const starts = subgraphNodes.filter((n) => n.type === 'start').map((n) => n.id)
    const entries =
      starts.length > 0
        ? starts
        : subgraphNodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id)
    if (entries.length === 0) {
      return { output: {}, trace: [], stepCount: 0, error: 'subgraph has no entry node' }
    }

    const visitCounts = new Map<string, number>()
    const executedIds = new Set<string>()
    let skippedIds = new Set<string>()
    const localMessages: ChatMessage[] = Array.isArray(inputState.messages)
      ? [...(inputState.messages as ChatMessage[])]
      : []
    const localOutputs: Record<string, unknown> = { ...inputState }
    const deferCounts = new Map<string, number>()
    const trace: TraceEntry[] = []

    const queue = [...entries]
    for (const id of entries) visitCounts.set(id, 1)
    let stepCount = 0
    let i = 0

    while (i < queue.length) {
      const nodeId = queue[i]
      i++
      const node = nodeById.get(nodeId)
      if (!node || skippedIds.has(nodeId)) continue

      // Join barrier: defer (re-queue) until every incoming branch has run or
      // been skipped, bounded by the remaining queue length.
      if (node.type === 'join') {
        const ready = joinReadiness(sources(nodeId), executedIds, skippedIds)
        const pending = queue.length - i
        const deferred = deferCounts.get(nodeId) ?? 0
        if (!ready && deferred < pending) {
          deferCounts.set(nodeId, deferred + 1)
          queue.push(nodeId)
          continue
        }
      }

      if (parentRunToken !== runToken) {
        return { output: {}, trace: [], stepCount: 0, error: 'aborted' }
      }
      const startedAt = Date.now()
      await delay(nodeStepDurationMs(node.type))
      if (parentRunToken !== runToken) {
        return { output: {}, trace: [], stepCount: 0, error: 'aborted' }
      }

      let output: unknown = fakeOutputFor(node, '')
      const latest = [...localMessages].reverse()[0]?.content ?? ''
      const forceElse = (visitCounts.get(nodeId) ?? 1) >= MAX_NODE_VISITS

      if (node.type === 'condition') {
        const branches = node.data.branches ?? []
        const decision = evaluateConditionBranches(branches, latest, forceElse)
        output = {
          evaluated: branches,
          taken: decision.taken,
          matched: decision.matched,
          forced_else: forceElse,
        }
      } else if (node.type === 'router') {
        const decision = pickRouteByKeyword(node.data.routes ?? [], latest)
        output = {
          routes: node.data.routes ?? [],
          taken: decision.taken,
          matched_on: decision.matchedOn,
        }
      } else if (node.type === 'evaluator') {
        const branches = node.data.evalBranches ?? ['pass', 'fail']
        const decision = evaluateConditionBranches(branches, latest, forceElse)
        output = {
          score_type: node.data.scoreType ?? 'pass_fail',
          evaluated: branches,
          taken: decision.taken,
          matched: decision.matched,
          forced_else: forceElse,
          note: '(simulated judge)',
        }
      } else if (node.type === 'guardrail') {
        if ((node.data.checkType ?? 'keyword') === 'keyword') {
          const decision = evaluateKeywordGuardrail(node.data.criteria ?? '', latest)
          output = { taken: decision.taken, matched: decision.matched }
        } else {
          output = { taken: 'pass', note: '(simulated judge)' }
        }
      } else if (node.type === 'join') {
        const inputs = sources(nodeId)
          .filter((s) => executedIds.has(s))
          .map((s) => ({ source: s, output: localOutputs[s] }))
        output = mergeJoinInputs(inputs, node.data.mergeStrategy ?? 'concat')
      }

      // Live execution: nodes in LIVE_EXECUTED_TYPES make real provider calls
      // against the local transcript fork, reusing the parent's
      // abortController so Stop/Pause cancels an in-flight inner call.
      const isLive =
        liveMode && node.type !== undefined && LIVE_EXECUTED_TYPES.includes(node.type)
      if (isLive) {
        switch (node.type) {
          case 'start': {
            output = {
              inputs: { message: localMessages[localMessages.length - 1]?.content ?? '' },
            }
            break
          }
          case 'llm': {
            const base = useLLMConfigStore.getState().getConfig()
            const override = (node.data.modelOverride ?? '').trim()
            const config =
              override === ''
                ? base
                : { ...base, settings: { ...base.settings, model: override } }
            const { systemPrompt } = resolveNodePrompts(node.data)
            const chat: ChatMessage[] = [
              {
                role: 'system',
                content: systemPrompt || 'You are a helpful assistant.',
              },
              ...localMessages,
            ]
            set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
            abortController?.abort()
            abortController = new AbortController()
            const full = await streamChat(
              withMaxTokens(config, node.data.maxTokens),
              chat,
              (chunk) => appendStream(nodeId, chunk),
              abortController.signal,
            )
            flushStreams()
            if (parentRunToken !== runToken) {
              return { output: {}, trace: [], stepCount: 0, error: 'aborted' }
            }
            localMessages.push({ role: 'assistant', content: full })
            metrics.addTokens(estimateTokens(full))
            output = {
              role: 'assistant',
              content: truncate(full, 400),
              model: node.data.model ?? '—',
              temperature: node.data.temperature ?? 0.7,
            }
            break
          }
          case 'router': {
            const routes = (node.data.routes ?? []).filter(Boolean)
            if (routes.length === 0) {
              output = { taken: 'default', matched_on: null }
              break
            }
            const base = useLLMConfigStore.getState().getConfig()
            const override = (node.data.modelOverride ?? '').trim()
            const config =
              override === ''
                ? base
                : { ...base, settings: { ...base.settings, model: override } }
            const chat: ChatMessage[] = [
              {
                role: 'system',
                content: `${node.data.routingPrompt ?? 'Classify the request.'}\nRespond with exactly one of: ${routes.join(', ')}. Reply with the route name only.`,
              },
              ...localMessages,
            ]
            set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
            abortController?.abort()
            abortController = new AbortController()
            const reply = await streamChat(
              withMaxTokens(config, node.data.maxTokens),
              chat,
              (chunk) => appendStream(nodeId, chunk),
              abortController.signal,
            )
            flushStreams()
            if (parentRunToken !== runToken) {
              return { output: {}, trace: [], stepCount: 0, error: 'aborted' }
            }
            metrics.addTokens(estimateTokens(reply))
            const lower = reply.toLowerCase()
            const matched = routes.find((r) => lower.includes(r.toLowerCase()))
            output = {
              taken: matched ?? routes[0],
              matched_on: matched ?? null,
              reply: truncate(reply, 120),
            }
            break
          }
          case 'guardrail': {
            if ((node.data.checkType ?? 'keyword') !== 'keyword') {
              const base = useLLMConfigStore.getState().getConfig()
              const override = (node.data.modelOverride ?? '').trim()
              const config =
                override === ''
                  ? base
                  : { ...base, settings: { ...base.settings, model: override } }
              const chat: ChatMessage[] = [
                {
                  role: 'system',
                  content: `${node.data.criteria ?? 'Judge whether the response is acceptable.'}\nReply with exactly PASS or FAIL.`,
                },
                ...localMessages,
              ]
              set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
              abortController?.abort()
              abortController = new AbortController()
              const reply = await streamChat(
                withMaxTokens(config, node.data.maxTokens),
                chat,
                (chunk) => appendStream(nodeId, chunk),
                abortController.signal,
              )
              flushStreams()
              if (parentRunToken !== runToken) {
                return { output: {}, trace: [], stepCount: 0, error: 'aborted' }
              }
              metrics.addTokens(estimateTokens(reply))
              const taken = reply.toLowerCase().includes('fail') ? 'fail' : 'pass'
              output = { taken, verdict: truncate(reply, 80) }
            }
            break
          }
          case 'evaluator': {
            const branches = (node.data.evalBranches ?? ['pass', 'fail']).filter(Boolean)
            if (branches.length === 0) {
              output = { taken: 'pass', note: 'no branches configured' }
              break
            }
            const base = useLLMConfigStore.getState().getConfig()
            const override = (node.data.modelOverride ?? '').trim()
            const config =
              override === ''
                ? base
                : { ...base, settings: { ...base.settings, model: override } }
            const rubric = node.data.scoringPrompt ?? 'Score the response.'
            const chat: ChatMessage[] = [
              {
                role: 'system',
                content: `${rubric}\nReply with exactly one of: ${branches.join(', ')}. Reply with the branch name only.`,
              },
              ...localMessages,
            ]
            set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
            abortController?.abort()
            abortController = new AbortController()
            const reply = await streamChat(
              withMaxTokens(config, node.data.maxTokens),
              chat,
              (chunk) => appendStream(nodeId, chunk),
              abortController.signal,
            )
            flushStreams()
            if (parentRunToken !== runToken) {
              return { output: {}, trace: [], stepCount: 0, error: 'aborted' }
            }
            metrics.addTokens(estimateTokens(reply))
            const lower = reply.toLowerCase()
            const matched = branches.find((b) => lower.includes(b.toLowerCase()))
            const taken = forceElse
              ? branches[branches.length - 1]
              : (matched ?? branches[branches.length - 1])
            output = {
              score_type: node.data.scoreType ?? 'pass_fail',
              evaluated: branches,
              taken,
              matched: !forceElse && matched !== undefined,
              forced_else: forceElse,
              verdict: truncate(reply, 120),
            }
            break
          }
          case 'join': {
            // output already computed above via mergeJoinInputs; append a
            // transcript summary so downstream live LLM calls see it.
            const merged = output as { waited_for?: number; merged?: unknown }
            appendStream(nodeId, JSON.stringify(merged.merged ?? null, null, 2))
            localMessages.push({
              role: 'user',
              content: `[${node.data.label}] merged ${merged.waited_for ?? 0} branch result(s)`,
            })
            break
          }
          case 'output': {
            const lastAssistant = [...localMessages].reverse().find((m) => m.role === 'assistant')
            output = { final_reply: truncate(lastAssistant?.content ?? '', 400) }
            break
          }
        }
      }

      if (!isLive && (node.type === 'llm' || node.type === 'agent')) {
        const o = output as { content?: unknown; final_answer?: unknown }
        const content = o?.content ?? o?.final_answer
        if (typeof content === 'string' && content !== '') {
          localMessages.push({ role: 'assistant', content })
        }
      }

      localOutputs[nodeId] = output
      executedIds.add(nodeId)
      stepCount++
      trace.push({
        id: crypto.randomUUID(),
        at: Date.now(),
        nodeId,
        nodeName: node.data.label,
        nodeType: node.type ?? 'unknown',
        status: 'ok',
        engine: isLive ? 'live' : 'simulated',
        durationMs: Date.now() - startedAt,
        input: '—',
        output: truncate(JSON.stringify(output), 120),
        parentNodeId,
      })

      let nextTargets: string[]
      if (isRoutingType(node.type)) {
        const taken = (output as { taken?: unknown } | null)?.taken
        const resolution = resolveSubgraphCondition(
          nodeId,
          taken,
          edges,
          executedIds,
          skippedIds,
        )
        skippedIds = resolution.skipped
        nextTargets = resolution.targets
        for (const skId of resolution.newlySkipped) {
          const skNode = nodeById.get(skId)
          if (!skNode) continue
          trace.push({
            id: crypto.randomUUID(),
            at: Date.now(),
            nodeId: skId,
            nodeName: skNode.data.label,
            nodeType: skNode.type ?? 'unknown',
            status: 'skipped',
            durationMs: 0,
            input: '—',
            output: 'branch not taken',
            parentNodeId,
          })
        }
      } else {
        nextTargets = targets(nodeId)
      }

      for (const t of nextTargets) {
        if (skippedIds.has(t)) continue
        if ((visitCounts.get(t) ?? 0) >= MAX_NODE_VISITS) continue
        if (queue.slice(i).includes(t)) continue
        visitCounts.set(t, (visitCounts.get(t) ?? 0) + 1)
        queue.push(t)
      }
    }

    // Expose the inner graph's terminal Output node (if any) under a stable
    // `output` key so outputMapping can reference it regardless of its id.
    const outputNode = subgraphNodes.find(
      (n) => n.type === 'output' && executedIds.has(n.id),
    )
    if (outputNode) {
      localOutputs.output = localOutputs[outputNode.id]
    }

    return { output: localOutputs, trace, stepCount, localMessages }
  }

  /**
   * Execute the node at the queue head. `token` must match `runToken` for
   * any state writes after an await — stop/pause/restart bump the token, so
   * results of an execution they interrupted are discarded, never written
   * into the reset (or restarted) run.
   */
  const executeCurrent = async (token: number): Promise<void> => {
    if (stepInFlight || finished()) return
    const { executionQueue, currentNodeIndex } = get()
    const nodeId = executionQueue[currentNodeIndex]
    const node = nodeId ? findNode(nodeId) : undefined
    if (!nodeId || !node) {
      set({
        currentNodeIndex: currentNodeIndex + 1,
        activeId: executionQueue[currentNodeIndex + 1] ?? null,
      })
      return
    }
    stepInFlight = true
    try {
      const metrics = useSimulationMetricsStore.getState()
      metrics.setStep(currentNodeIndex, executionQueue.length)

      // Defensive: skip-marked entries are filtered from the pending queue
      // when the condition resolves, so a marked head just advances.
      if (get().skippedNodeIds.has(nodeId)) {
        set({
          currentNodeIndex: currentNodeIndex + 1,
          activeId: executionQueue[currentNodeIndex + 1] ?? null,
        })
        if (finished()) finishRun()
        return
      }

      // Join barrier: wait until every incoming branch has executed or been
      // skip-marked. If not ready, move the join to the queue tail (without
      // consuming its visit budget) so the remaining branches run first.
      // Readiness is recomputed here every time the join resurfaces, so a
      // skip-mark that lands after a defer is seen. A per-join defer counter
      // bounds the wait: once it reaches the pending-queue length, the join is
      // forced (an unreachable source can't livelock the run).
      if (node.type === 'join') {
        const sources = flowSources(nodeId)
        const ready = joinReadiness(
          sources,
          get().executedIds,
          get().skippedNodeIds,
        )
        const pending = get().executionQueue.length - currentNodeIndex
        const deferred = joinDeferCounts.get(nodeId) ?? 0
        if (!ready && deferred < pending) {
          joinDeferCounts.set(nodeId, deferred + 1)
          const queue = [...get().executionQueue]
          queue.splice(currentNodeIndex, 1)
          queue.push(nodeId)
          set({
            executionQueue: queue,
            activeId: queue[currentNodeIndex] ?? null,
          })
          return
        }
      }

      const fanOut =
        node.type === 'supervisor'
          ? useCanvasStore.getState().edges.filter((e) => e.source === nodeId)
              .length
          : 0
      metrics.setActiveNodeCount(1 + fanOut)

      const startedAt = Date.now()
      const prevId = executionQueue[currentNodeIndex - 1]
      const prevLabel = prevId ? findNode(prevId)?.data.label : undefined
      const input =
        node.type === 'start'
          ? get().userInput || 'Hello!'
          : prevLabel
            ? `from ${prevLabel}`
            : '—'
      const engine: ExecutionEngine =
        get().liveMode &&
        node.type !== undefined &&
        LIVE_EXECUTED_TYPES.includes(node.type)
          ? 'live'
          : 'simulated'
      const makeEntry = (
        status: TraceEntry['status'],
        output: unknown,
      ): TraceEntry => ({
        id: crypto.randomUUID(),
        at: Date.now(),
        nodeId,
        nodeName: node.data.label,
        nodeType: node.type ?? 'unknown',
        status,
        engine,
        durationMs: Date.now() - startedAt,
        input: truncate(input, 80),
        output: truncate(JSON.stringify(output), 120),
      })
      // T2-2: capture a full (untruncated) state snapshot alongside the trace
      // entry so the Time-Travel Debugger can replay this step. stepIndex is read
      // at build time; each call site appends exactly one snapshot in one set().
      const makeSnapshot = (
        entry: TraceEntry,
        fullOutput: unknown,
      ): StepSnapshot => ({
        stepIndex: get().snapshots.length,
        nodeId: entry.nodeId,
        nodeName: entry.nodeName,
        nodeType: entry.nodeType,
        inputState: resolveCacheInput(nodeId, node) as Record<string, unknown>,
        outputState: fullOutput,
        messagesState: structuredClone(get().messages),
        at: entry.at,
        durationMs: entry.durationMs,
        status: entry.status,
      })

      // Try/Catch: does not execute itself. Mark the onSuccess subgraph as
      // "guarded" and enqueue only the onSuccess target; the onError branch
      // stays unscheduled unless a guarded node later fails.
      if (node.type === 'tryCatch') {
        const { onSuccessTarget, guarded } = findGuardedNodes(nodeId)
        for (const gId of guarded) guardedByMap.set(gId, nodeId)
        guardedRemaining.set(nodeId, new Set(guarded))
        const tcOutput = { guarding: [...guarded] }
        const guardResult = checkGuardSuccess(nodeId, get().skippedNodeIds)
        const tcEntry = makeEntry('ok', tcOutput)
        const nextIdxTc = currentNodeIndex + 1
        const tcTargets =
          onSuccessTarget && flowNodeIds().has(onSuccessTarget) ? [onSuccessTarget] : []
        const grownTc = enqueueTargets(executionQueue, nextIdxTc, guardResult.skipped, tcTargets)
        const nextQueueTc = [
          ...grownTc.slice(0, nextIdxTc),
          ...grownTc.slice(nextIdxTc).filter((id) => !guardResult.skipped.has(id)),
        ]
        set({
          tryCatchStatus: {
            ...get().tryCatchStatus,
            [nodeId]: guardResult.success ? 'success' : 'watching',
          },
          nodeOutputs: { ...get().nodeOutputs, [nodeId]: tcOutput },
          nodeEngines: { ...get().nodeEngines, [nodeId]: 'simulated' },
          trace: [...get().trace, tcEntry, ...guardResult.skipEntries],
          snapshots: [...get().snapshots, makeSnapshot(tcEntry, tcOutput)],
          executedIds: new Set(get().executedIds).add(nodeId),
          skippedNodeIds: guardResult.skipped,
          executionQueue: nextQueueTc,
          currentNodeIndex: nextIdxTc,
          activeId: nextQueueTc[nextIdxTc] ?? null,
        })
        if (finished()) finishRun()
        return
      }

      // Retry: does not execute itself. Registers the single downstream node
      // as "wrapped" so its failures/empty outputs are retried with backoff.
      if (node.type === 'retry') {
        const target = flowTargets(nodeId)[0]
        const cfg =
          node.data.retry ??
          { maxAttempts: 3, backoffMs: 1000, backoffMultiplier: 2, retryOn: ['error'] as const }
        if (target) {
          retryWrapped.set(target, nodeId)
          retryAttempts.set(nodeId, 1)
        }
        const retryOutput = { maxAttempts: cfg.maxAttempts, wrapping: target ?? null }
        const retryEntry = makeEntry('ok', retryOutput)
        const nextIdxR = currentNodeIndex + 1
        const rTargets = target && flowNodeIds().has(target) ? [target] : []
        const grownR = enqueueTargets(executionQueue, nextIdxR, get().skippedNodeIds, rTargets)
        set({
          retryStatus: { ...get().retryStatus, [nodeId]: { attempt: 1, max: cfg.maxAttempts } },
          nodeOutputs: { ...get().nodeOutputs, [nodeId]: retryOutput },
          nodeEngines: { ...get().nodeEngines, [nodeId]: 'simulated' },
          trace: [...get().trace, retryEntry],
          snapshots: [...get().snapshots, makeSnapshot(retryEntry, retryOutput)],
          executedIds: new Set(get().executedIds).add(nodeId),
          executionQueue: grownR,
          currentNodeIndex: nextIdxR,
          activeId: grownR[nextIdxR] ?? null,
        })
        if (finished()) finishRun()
        return
      }

      let output: unknown
      // Trace entries from a Subgraph node's inner sub-walker, appended to
      // the parent trace alongside this node's own entry.
      let nestedTrace: TraceEntry[] = []

      // Only a node's first visit within a run is cache-eligible — loop/cycle
      // revisits within the same run must always re-execute (the walker's
      // visit-budget semantics, e.g. MAX_NODE_VISITS forcing the else branch,
      // depend on each revisit actually running).
      const cacheEligible =
        node.type !== undefined &&
        !CACHE_INELIGIBLE_TYPES.includes(node.type) &&
        !virtualMeta.has(nodeId) &&
        (visitCounts.get(nodeId) ?? 1) <= 1
      const inputHash = cacheEligible ? hashNodeInput(resolveCacheInput(nodeId, node)) : null
      const cacheHit =
        inputHash !== null &&
        get().nodeInputHashCache.get(nodeId) === inputHash &&
        nodeOutputCache.has(nodeId)

      if (cacheHit) {
        output = nodeOutputCache.get(nodeId)
      } else {
      try {
        if (node.type === 'subgraph') {
          // Subgraph runs its own inner walker regardless of liveMode — the
          // walker itself routes inner nodes between live and simulated.
          await delay(nodeStepDurationMs(node.type))
          output = fakeOutputFor(node, get().userInput)
          const ref = (node.data.subgraphRef ?? '').trim()
          if (ref) {
            let innerNodes: AgentFlowNode[] = []
            let innerEdges: AgentFlowEdge[] = []
            let parseError: string | undefined
            try {
              const parsed = JSON.parse(ref) as {
                nodes?: AgentFlowNode[]
                edges?: AgentFlowEdge[]
              }
              innerNodes = parsed.nodes ?? []
              innerEdges = parsed.edges ?? []
            } catch {
              parseError = 'Invalid subgraphRef — not valid JSON'
            }
            if (parseError) {
              output = { subgraph_ran: false, error: parseError }
            } else {
              const inputState = buildSubgraphInput(
                node.data.inputMapping,
                get().nodeOutputs,
                get().messages,
              )
              const result = await runSubgraph(
                innerNodes,
                innerEdges,
                inputState,
                token,
                nodeId,
                get().liveMode,
              )
              if (result.error === 'aborted') return
              if (result.error) {
                output = { subgraph_ran: false, error: result.error }
              } else {
                output = {
                  ...mergeSubgraphOutput(result.output, node.data.outputMapping),
                  _innerStepCount: result.stepCount,
                }
                nestedTrace = result.trace
                if (
                  node.data.appendToParent &&
                  result.localMessages &&
                  result.localMessages.length > 0
                ) {
                  const lastAssistant = [...result.localMessages]
                    .reverse()
                    .find((m) => m.role === 'assistant')
                  const summaryContent =
                    lastAssistant?.content ??
                    truncate(JSON.stringify(result.output), 400)
                  set({
                    messages: [
                      ...get().messages,
                      { role: 'assistant', content: summaryContent },
                    ],
                  })
                }
              }
            }
          }
          if (!get().liveMode) metrics.addTokens(fakeTokensFor(node))
        } else if (get().liveMode) {
          output = await executeLiveNode(node, nodeId)
        } else {
          const streamText = fakeStreamTextFor(node)
          if (streamText) {
            set({ nodeStreams: { ...get().nodeStreams, [nodeId]: streamText } })
          }
          await delay(nodeStepDurationMs(node.type))
          output = fakeOutputFor(node, get().userInput)
          if (node.type === 'condition') {
            // Evaluate the configured branch predicates against the latest
            // content; the matched branch name is the outgoing edge label the
            // walker routes to. The final visit forces the else so loops end.
            output = conditionOutput(nodeId, node.data.branches, latestContent())
          } else if (node.type === 'router') {
            // Route by keyword over the user input — configuration drives the
            // path even in the simulated engine.
            const decision = pickRouteByKeyword(
              node.data.routes ?? [],
              get().userInput,
            )
            output = {
              routes: node.data.routes ?? [],
              taken: decision.taken,
              matched_on: decision.matchedOn,
            }
          } else if (node.type === 'evaluator') {
            // Score the latest content against the configured branches:
            // first matching substring wins; last branch is the else;
            // the final allowed visit forces the else so loops terminate.
            const decision = conditionOutput(
              nodeId,
              node.data.evalBranches,
              latestContent(),
            )
            output = {
              score_type: node.data.scoreType ?? 'pass_fail',
              evaluated: decision.evaluated,
              taken: decision.taken,
              matched: decision.matched,
              forced_else: decision.forced_else,
              note: '(simulated judge)',
            }
          } else if (node.type === 'guardrail') {
            // Keyword guardrail runs for real against the most recent content
            // (retriever output, an LLM reply…), falling back to the user
            // input so the check is meaningful even before any node has run.
            // llm-judge passes deterministically in the simulated engine.
            const last = [...get().messages].reverse()[0]
            const content = last?.content ?? get().userInput
            if ((node.data.checkType ?? 'keyword') === 'keyword') {
              const decision = evaluateKeywordGuardrail(
                node.data.criteria ?? '',
                content,
              )
              output = { taken: decision.taken, matched: decision.matched }
            } else {
              output = { taken: 'pass', note: '(simulated judge)' }
            }
          } else if (node.type === 'join') {
            output = mergeJoinForNode(nodeId, node.data.mergeStrategy ?? 'concat')
          } else if (node.type === 'mcpServer') {
            // Echo the upstream tool call back with a fake result.
            const toolCall = parseToolCall(latestContent())
            const fakeName = toolCall?.name ?? 'unknown_tool'
            output = {
              tool: fakeName,
              result: `[Simulated] Tool "${fakeName}" returned successfully.`,
              timestamp: new Date().toISOString(),
            }
          }
          metrics.addTokens(fakeTokensFor(node))
        }
      } catch (error) {
        // Interrupted by stop/pause/restart: not a real failure — discard.
        if (token !== runToken) return
        const message = error instanceof Error ? error.message : String(error)

        // Retry: re-attempt this node with backoff instead of halting.
        const retryDone = await maybeRetry(nodeId, token, 'error')
        if (retryDone === 'retried') return
        if (retryDone === 'exhausted') {
          runToken++
          set({
            isRunning: false,
            erroredNodeIds: [...get().erroredNodeIds, nodeId],
            nodeOutputs: { ...get().nodeOutputs, [nodeId]: { error: message } },
            trace: [...get().trace, makeEntry('error', { error: message })],
            snapshots: [
              ...get().snapshots,
              makeSnapshot(makeEntry('error', { error: message }), { error: message }),
            ],
          })
          metrics.pauseTimer()
          if (get().liveMode) {
            useLLMConfigStore.getState().setLiveError(message)
          }
          return
        }

        // Try/Catch: reroute to onError instead of halting the run.
        const tcId = guardedByMap.get(nodeId)
        if (tcId) {
          const tcNode = findNode(tcId)
          const { onErrorTarget } = findGuardedNodes(tcId)
          const fallback = tcNode?.data.tryCatch?.fallbackOutput ?? ''
          const remaining = guardedRemaining.get(tcId)
          const skipped = new Set(get().skippedNodeIds)
          const skipEntries: TraceEntry[] = []
          if (remaining) {
            for (const id of remaining) {
              if (id === nodeId || skipped.has(id) || get().executedIds.has(id)) continue
              skipped.add(id)
              const n = findNode(id)
              if (!n) continue
              skipEntries.push({
                id: crypto.randomUUID(),
                at: Date.now(),
                nodeId: id,
                nodeName: n.data.label,
                nodeType: n.type ?? 'unknown',
                status: 'skipped',
                durationMs: 0,
                input: '—',
                output: 'skipped after caught error',
              })
            }
            remaining.clear()
          }
          const nextIndexTc = currentNodeIndex + 1
          const targets = onErrorTarget && flowNodeIds().has(onErrorTarget) ? [onErrorTarget] : []
          const grown = enqueueTargets(executionQueue, nextIndexTc, skipped, targets)
          const nextQueueTc = [
            ...grown.slice(0, nextIndexTc),
            ...grown.slice(nextIndexTc).filter((id) => !skipped.has(id)),
          ]
          const prevTcOutput = get().nodeOutputs[tcId]
          set({
            tryCatchStatus: { ...get().tryCatchStatus, [tcId]: 'error' },
            erroredNodeIds: [...get().erroredNodeIds, nodeId],
            nodeOutputs: {
              ...get().nodeOutputs,
              [nodeId]: { error: message },
              [tcId]: {
                ...(prevTcOutput as object),
                error: message,
                fallbackOutput: fallback,
              },
            },
            trace: [...get().trace, makeEntry('error', { error: message }), ...skipEntries],
            snapshots: [
              ...get().snapshots,
              makeSnapshot(makeEntry('error', { error: message }), { error: message }),
            ],
            skippedNodeIds: skipped,
            executionQueue: nextQueueTc,
            currentNodeIndex: nextIndexTc,
            activeId: nextQueueTc[nextIndexTc] ?? null,
          })
          if (finished()) finishRun()
          return
        }

        // Genuine failure: pause without advancing, so Play retries this
        // node once the user has fixed the problem.
        runToken++
        set({
          isRunning: false,
          erroredNodeIds: [...get().erroredNodeIds, nodeId],
          nodeOutputs: { ...get().nodeOutputs, [nodeId]: { error: message } },
          trace: [...get().trace, makeEntry('error', { error: message })],
        })
        metrics.pauseTimer()
        if (get().liveMode) {
          useLLMConfigStore.getState().setLiveError(message)
        }
        return
      }
      }

      // Stopped or restarted while this node was executing — discard.
      if (token !== runToken) return

      if (cacheEligible && inputHash !== null && !cacheHit) {
        nodeOutputCache.set(nodeId, output)
        get().setCachedHash(nodeId, inputHash)
      }

      // Loop nodes report their actual visit as the iteration (both modes).
      if (node.type === 'loop') {
        const visits = visitCounts.get(nodeId) ?? 1
        output = {
          iteration: visits,
          until: node.data.loopCondition ?? '',
          done: visits >= MAX_NODE_VISITS,
        }
      }

      // Code Executor: first attempt fails (default fake), subsequent attempts
      // (a re-visit caused by a fix loop) "succeed" so the loop can terminate.
      if (node.type === 'codeExecutor' && (visitCounts.get(nodeId) ?? 1) >= 2) {
        output = {
          language: node.data.language ?? 'python',
          stdout: 'OK\nResult: 42',
          stderr: '',
          exit_code: 0,
          execution_time_ms: 142,
        }
      }

      // Map node — true per-item simulation: expand into N virtual branches
      // (one per item), skip-mark the real body, register virtual terminals as
      // join sources. Falls back to the legacy single-step fan when no
      // downstream join exists.
      if (node.type === 'map') {
        const expansion = expandMap(node, nodeId)
        if (expansion) {
          const { items, entryVids, bodyIds, joinId } = expansion
          const mapOutput = {
            map_ran: true,
            item_count: items.length,
            items,
            over: node.data.inputExpression ?? 'items',
            max_parallel: node.data.maxParallel ?? 10,
            _mapBranchCount: items.length,
          }
          const newSkipped = new Set(get().skippedNodeIds)
          const skipTrace: TraceEntry[] = []
          for (const bId of bodyIds) {
            if (newSkipped.has(bId) || get().executedIds.has(bId)) continue
            newSkipped.add(bId)
            const bNode = findNode(bId)
            if (!bNode) continue
            skipTrace.push({
              id: crypto.randomUUID(),
              at: Date.now(),
              nodeId: bId,
              nodeName: bNode.data.label,
              nodeType: bNode.type ?? 'unknown',
              status: 'skipped',
              durationMs: 0,
              input: '—',
              output: 'expanded into map branches',
            })
          }
          for (const vid of entryVids) {
            if (!visitCounts.has(vid)) visitCounts.set(vid, 1)
          }
          // Set visit budget for every virtual node (entries + interior).
          for (const vid of virtualNodes.keys()) {
            if (!visitCounts.has(vid)) visitCounts.set(vid, 1)
          }
          const nextIdxMap = get().currentNodeIndex + 1
          const baseQueue = get().executionQueue
          // Enqueue the join after the virtual entries — the body's canvas
          // path is skip-marked, so without this the join is never reached.
          // joinReadiness will defer it at the head until every virtual
          // terminal has executed.
          if (!visitCounts.has(joinId)) visitCounts.set(joinId, 1)
          const tail = baseQueue
            .slice(nextIdxMap)
            .filter((id) => !newSkipped.has(id) && id !== joinId)
          const grown = [
            ...baseQueue.slice(0, nextIdxMap),
            ...entryVids,
            joinId,
            ...tail,
          ]
          set({
            nodeOutputs: { ...get().nodeOutputs, [nodeId]: mapOutput },
            nodeEngines: { ...get().nodeEngines, [nodeId]: engine },
            trace: [
              ...get().trace,
              makeEntry('ok', mapOutput),
              ...skipTrace,
            ],
            snapshots: [
              ...get().snapshots,
              makeSnapshot(makeEntry('ok', mapOutput), mapOutput),
            ],
            executedIds: new Set(get().executedIds).add(nodeId),
            skippedNodeIds: newSkipped,
            executionQueue: grown,
            currentNodeIndex: nextIdxMap,
            activeId: grown[nextIdxMap] ?? null,
          })
          useSimulationMetricsStore
            .getState()
            .setStep(nextIdxMap, grown.length)
          if (finished()) finishRun()
          return
        }
      }

      // Retry: an empty output counts as a failure for nodes configured with
      // retryOn 'empty_output' (or 'any') — retry with backoff, or halt once
      // attempts are exhausted.
      if (
        retryWrapped.has(nodeId) &&
        (output == null ||
          (typeof output === 'object' && Object.keys(output as object).length === 0))
      ) {
        const retryDone = await maybeRetry(nodeId, token, 'empty_output')
        if (retryDone === 'retried') return
        if (retryDone === 'exhausted') {
          runToken++
          set({
            isRunning: false,
            erroredNodeIds: [...get().erroredNodeIds, nodeId],
            trace: [...get().trace, makeEntry('error', { error: 'empty output after retries' })],
            snapshots: [
              ...get().snapshots,
              makeSnapshot(makeEntry('error', { error: 'empty output after retries' }), {
                error: 'empty output after retries',
              }),
            ],
          })
          metrics.pauseTimer()
          return
        }
      }

      // Virtual node (a Map per-item branch): inject _mapItem/_mapIndex into
      // the recorded output so the State Inspector and downstream Join see the
      // per-item identity. Trace entry is stamped with parentNodeId = mapId.
      const vMeta = virtualMeta.get(nodeId)
      if (vMeta && output !== null && typeof output === 'object') {
        output = {
          _mapIndex: vMeta.index,
          _mapItem: vMeta.item,
          ...(output as Record<string, unknown>),
        }
      }

      // Walk forward: routing nodes (condition/router/guardrail/evaluator)
      // follow only the taken edge (marking the rest skipped); every other
      // node fans out to all flow targets. Successors are discovered now, after
      // this node ran — see scheduleNextNodes (the dynamic walker's core).
      let { nextIndex, nextQueue, skipped, skipEntries } = scheduleNextNodes(
        node,
        nodeId,
        output,
      )

      // Try/Catch: a guarded node finished ok — remove it from its TryCatch's
      // remaining set. If that was the last one, the success path is
      // confirmed and the onError branch is skip-marked.
      const tcId = guardedByMap.get(nodeId)
      let tryCatchStatusUpdate: Record<string, 'watching' | 'success' | 'error'> | undefined
      if (tcId) {
        guardedRemaining.get(tcId)?.delete(nodeId)
        const guardResult = checkGuardSuccess(tcId, skipped)
        skipped = guardResult.skipped
        skipEntries = [...skipEntries, ...guardResult.skipEntries]
        if (guardResult.success) {
          tryCatchStatusUpdate = { ...get().tryCatchStatus, [tcId]: 'success' }
          nextQueue = [
            ...nextQueue.slice(0, nextIndex),
            ...nextQueue.slice(nextIndex).filter((id) => !skipped.has(id)),
          ]
        }
      }

      const errored = get().erroredNodeIds
      // Stamp parentNodeId on a virtual node's trace entry (Map per-item
      // branch) so the trace can be grouped by its originating Map node.
      const baseEntry = cacheHit
        ? { ...makeEntry('cached', output), durationMs: 0 }
        : makeEntry('ok', output)
      const parentMapId = virtualParents.get(nodeId)
      const taggedEntry: TraceEntry = parentMapId
        ? { ...baseEntry, parentNodeId: parentMapId }
        : baseEntry
      set({
        erroredNodeIds: errored.includes(nodeId)
          ? errored.filter((id) => id !== nodeId)
          : errored,
        nodeOutputs: { ...get().nodeOutputs, [nodeId]: output },
        nodeEngines: { ...get().nodeEngines, [nodeId]: engine },
        trace: [...get().trace, taggedEntry, ...skipEntries, ...nestedTrace],
        snapshots: [...get().snapshots, makeSnapshot(taggedEntry, output)],
        executedIds: new Set(get().executedIds).add(nodeId),
        skippedNodeIds: skipped,
        executionQueue: nextQueue,
        currentNodeIndex: nextIndex,
        activeId: nextQueue[nextIndex] ?? null,
        ...(tryCatchStatusUpdate ? { tryCatchStatus: tryCatchStatusUpdate } : {}),
      })
      // Human-in-the-loop gate: the node has completed and been recorded;
      // now halt and wait for the user. No runToken bump — nothing is in
      // flight (HIL is synchronous), so play()/step() simply resume once
      // pendingApproval clears.
      if (node.type === 'humanInLoop' && !finished()) {
        set({ isRunning: false, pendingApproval: { nodeId } })
        useSimulationMetricsStore.getState().pauseTimer()
        return
      }
      if (finished()) finishRun()
    } finally {
      stepInFlight = false
    }
  }

  const runLoop = async (token: number): Promise<void> => {
    while (
      token === runToken &&
      get().isActive &&
      get().isRunning &&
      !finished()
    ) {
      await executeCurrent(token)
      if (token !== runToken || !get().isActive) return
      await delay(LOOP_GAP_MS)
    }
  }

  const resetRunState = (executionQueue: string[]) => {
    discardPendingStreams()
    visitCounts = new Map(executionQueue.map((id) => [id, 1]))
    joinDeferCounts = new Map()
    clearVirtualState()
    clearFlowControlState()
    set({
      currentNodeIndex: 0,
      executionQueue,
      activeId: executionQueue[0] ?? null,
      executedIds: new Set<string>(),
      skippedNodeIds: new Set<string>(),
      nodeEngines: {},
      messages: [],
      nodeOutputs: {},
      nodeStreams: {},
      erroredNodeIds: [],
      trace: [],
      snapshots: [],
      pendingApproval: null,
      tryCatchStatus: {},
      retryStatus: {},
    })
    const metrics = useSimulationMetricsStore.getState()
    metrics.resetAll()
    metrics.setStep(0, executionQueue.length)
  }

  return {
    isActive: false,
    isRunning: false,
    currentNodeIndex: 0,
    executionQueue: [],
    activeId: null,
    executedIds: new Set<string>(),
    skippedNodeIds: new Set<string>(),
    nodeEngines: {},
    liveMode: false,
    userInput: '',
    messages: [],
    nodeOutputs: {},
    nodeStreams: {},
    erroredNodeIds: [],
    trace: [],
    snapshots: [],
    traceOpen: false,
    pendingApproval: null,
    tryCatchStatus: {},
    retryStatus: {},
    nodeInputHashCache: new Map<string, string>(),

    setLiveMode: (liveMode) => set({ liveMode }),
    setUserInput: (userInput) => set({ userInput }),
    setTraceOpen: (traceOpen) => set({ traceOpen }),
    clearTrace: () => set({ trace: [] }),
    clearHashCache: () => {
      nodeOutputCache = new Map()
      set({ nodeInputHashCache: new Map() })
    },
    setCachedHash: (nodeId, hash) =>
      set({
        nodeInputHashCache: new Map(get().nodeInputHashCache).set(nodeId, hash),
      }),

    start: () => {
      const executionQueue = buildSeeds()
      if (executionQueue.length === 0) return

      // Unguarded-cycle warning — does NOT block execution. Guarded cycles
      // (router/condition/guardrail on the cycle path) are valid by design;
      // MAX_NODE_VISITS remains the real runtime safety net either way.
      const { nodes: cycleNodes, edges: cycleEdges } = useCanvasStore.getState()
      const { hasCycle, cyclePath } = detectCycle(cycleNodes, cycleEdges)
      if (hasCycle && !hasEscapeOnCycle(cyclePath, cycleNodes, ESCAPE_NODE_TYPES)) {
        useToastStore.getState().pushToast(
          `Unguarded cycle detected: ${cyclePath.join(' → ')}. Execution continues with MAX_NODE_VISITS guard.`,
          'warning',
        )
      }

      runToken++
      set({ isActive: true })
      resetRunState(executionQueue)
      get().play()
    },

    stop: () => {
      runToken++
      get().clearHashCache()
      abortInFlight()
      discardPendingStreams()
      visitCounts = new Map()
      joinDeferCounts = new Map()
      clearVirtualState()
      clearFlowControlState()
      if (get().isActive && get().trace.length > 0) {
        useSimulationMetricsStore.getState().pauseTimer()
        recordRunHistory('stopped', buildCostSummary(get().trace), null)
      }
      set({
        isActive: false,
        isRunning: false,
        currentNodeIndex: 0,
        executionQueue: [],
        activeId: null,
        executedIds: new Set<string>(),
        skippedNodeIds: new Set<string>(),
        nodeEngines: {},
        messages: [],
        nodeOutputs: {},
        nodeStreams: {},
        erroredNodeIds: [],
        trace: [],
        snapshots: [],
        pendingApproval: null,
        tryCatchStatus: {},
        retryStatus: {},
      })
      useSimulationMetricsStore.getState().resetAll()
    },

    play: () => {
      // A pending Human-in-Loop gate blocks playback until approve/reject.
      if (
        !get().isActive ||
        get().isRunning ||
        finished() ||
        get().pendingApproval
      )
        return
      set({ isRunning: true })
      useSimulationMetricsStore.getState().startTimer()
      const token = ++runToken
      void runLoop(token)
    },

    pause: () => {
      runToken++
      abortInFlight()
      flushStreams()
      set({ isRunning: false })
      useSimulationMetricsStore.getState().pauseTimer()
    },

    step: () => {
      if (!get().isActive || finished() || get().pendingApproval) return
      const token = ++runToken
      set({ isRunning: false })
      const metrics = useSimulationMetricsStore.getState()
      metrics.startTimer()
      void executeCurrent(token).then(() => {
        if (!get().isRunning) metrics.pauseTimer()
      })
    },

    restart: () => {
      runToken++
      abortInFlight()
      resetRunState(buildSeeds())
      get().play()
    },

    forkFromSnapshot: (snapshots, stepIndex) => {
      if (get().isRunning) return
      const target = snapshots[stepIndex]
      if (!target) return
      const priorSnapshots = snapshots.slice(0, stepIndex)

      runToken++
      abortInFlight()
      set({ isActive: true })
      resetRunState([target.nodeId])

      for (const s of priorSnapshots) {
        visitCounts.set(s.nodeId, (visitCounts.get(s.nodeId) ?? 0) + 1)
      }

      const nodeOutputs: Record<string, unknown> = {}
      const executedIds = new Set<string>()
      const erroredNodeIds: string[] = []
      const skippedNodeIds = new Set<string>()
      for (const s of priorSnapshots) {
        nodeOutputs[s.nodeId] = s.outputState
        if (s.status === 'ok' || s.status === 'cached') executedIds.add(s.nodeId)
        else if (s.status === 'error') erroredNodeIds.push(s.nodeId)
        else if (s.status === 'skipped') skippedNodeIds.add(s.nodeId)
      }
      const lastPrior = priorSnapshots[priorSnapshots.length - 1]
      set({
        nodeOutputs,
        executedIds,
        erroredNodeIds,
        skippedNodeIds,
        messages: lastPrior?.messagesState ?? [],
      })

      get().play()
    },

    approve: () => {
      const pending = get().pendingApproval
      if (!pending) return
      const prev = get().nodeOutputs[pending.nodeId]
      set({
        pendingApproval: null,
        nodeOutputs: {
          ...get().nodeOutputs,
          [pending.nodeId]: { ...(prev as object), approved: true },
        },
      })
      // Resume the walker from where the gate halted it.
      get().play()
    },

    submitHumanInput: (value) => {
      const pending = get().pendingApproval
      if (!pending) return
      const prev = get().nodeOutputs[pending.nodeId]
      set({
        pendingApproval: null,
        nodeOutputs: {
          ...get().nodeOutputs,
          [pending.nodeId]: { ...(prev as object), approved: true, userResponse: value },
        },
        // Also thread the typed response into the shared transcript so the
        // next downstream live LLM call (which reads ...get().messages) sees
        // it, not just the node's own output badge.
        messages: [...get().messages, { role: 'user', content: value }],
      })
      get().play()
    },

    reject: () => {
      const pending = get().pendingApproval
      if (!pending) return
      const hilId = pending.nodeId
      const { edges } = useCanvasStore.getState()
      // Skip everything downstream of the gate that has not already run.
      const downstream = reachableFrom(edges, hilId)
      downstream.delete(hilId)
      const skipped = new Set(get().skippedNodeIds)
      const skipEntries: TraceEntry[] = []
      for (const id of downstream) {
        if (get().executedIds.has(id) || skipped.has(id)) continue
        const n = findNode(id)
        if (!n) continue
        skipped.add(id)
        skipEntries.push({
          id: crypto.randomUUID(),
          at: Date.now(),
          nodeId: id,
          nodeName: n.data.label,
          nodeType: n.type ?? 'unknown',
          status: 'skipped',
          durationMs: 0,
          input: '—',
          output: 'rejected at human gate',
        })
      }
      const prev = get().nodeOutputs[hilId]
      const queue = get().executionQueue
      const errored = get().erroredNodeIds
      set({
        pendingApproval: null,
        skippedNodeIds: skipped,
        erroredNodeIds: errored.includes(hilId) ? errored : [...errored, hilId],
        nodeOutputs: {
          ...get().nodeOutputs,
          [hilId]: { ...(prev as object), approved: false },
        },
        trace: [...get().trace, ...skipEntries],
        // Force the run to a finished state: drop the now-skipped pending tail.
        currentNodeIndex: queue.length,
        activeId: null,
      })
      finishRun()
    },
  }
})
