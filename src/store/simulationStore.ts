import { create } from 'zustand'
import { topologicalSort } from '../utils/topologicalSort'
import {
  estimateTokens,
  fakeOutputFor,
  fakeStreamTextFor,
  fakeTokensFor,
  nodeStepDurationMs,
  truncate,
} from '../utils/fakeData'
import { streamChat } from '../llm'
import {
  evaluateConditionBranches,
  evaluateKeywordGuardrail,
  isRoutingType,
  joinReadiness,
  mergeJoinInputs,
  pickRouteByKeyword,
} from '../utils/flowSemantics'
import { useCanvasStore } from './canvasStore'
import { useLLMConfigStore } from './llmConfigStore'
import { useSimulationMetricsStore } from './simulationMetricsStore'
import type {
  AgentFlowNode,
  AgentFlowNodeType,
  ChatMessage,
  ExecutionEngine,
  TraceEntry,
} from '../types'

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
  traceOpen: boolean
  /** Set when a Human-in-Loop node has executed and is awaiting approval. */
  pendingApproval: { nodeId: string } | null
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
  /** Resume past a Human-in-Loop gate. */
  approve: () => void
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

function abortInFlight() {
  abortController?.abort()
  abortController = null
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms))

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
  return useCanvasStore.getState().nodes.find((n) => n.id === id)
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const useSimulationStore = create<SimulationState>((set, get) => {
  const finished = () =>
    get().currentNodeIndex >= get().executionQueue.length

  const finishRun = () => {
    set({ isRunning: false })
    const metrics = useSimulationMetricsStore.getState()
    metrics.pauseTimer()
    metrics.setActiveNodeCount(0)
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

  /** Flow-node successors of a node (what the walker enqueues next). */
  const flowTargets = (nodeId: string): string[] => {
    const ids = flowNodeIds()
    return useCanvasStore
      .getState()
      .edges.filter((e) => e.source === nodeId && ids.has(e.target))
      .map((e) => e.target)
  }

  /** Flow-node predecessors of a node (the branches a join waits on). */
  const flowSources = (nodeId: string): string[] => {
    const ids = flowNodeIds()
    return useCanvasStore
      .getState()
      .edges.filter((e) => e.target === nodeId && ids.has(e.source))
      .map((e) => e.source)
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
        const chat: ChatMessage[] = [
          {
            role: 'system',
            content: node.data.systemPrompt ?? 'You are a helpful assistant.',
          },
          ...get().messages,
        ]
        set({ nodeStreams: { ...get().nodeStreams, [nodeId]: '' } })
        abortController?.abort()
        abortController = new AbortController()
        const full = await streamChat(
          config,
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
        }
      }
      case 'tool':
      case 'retriever':
      case 'mcpServer': {
        // Stubbed in Live mode: mock data flows into the message history so
        // downstream LLM calls see a realistic transcript.
        const output = fakeOutputFor(node, get().userInput)
        const summary = `[${node.data.label}] ${truncate(JSON.stringify(output), 160)}`
        appendStream(nodeId, JSON.stringify(output, null, 2))
        set({
          messages: [...get().messages, { role: 'user', content: summary }],
        })
        metrics.addTokens(estimateTokens(summary))
        await delay(600)
        return output
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
          config,
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
          config,
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
          config,
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
        // Agents, supervisors, loops etc. stay simulated in Live mode.
        const streamText = fakeStreamTextFor(node)
        if (streamText) {
          set({ nodeStreams: { ...get().nodeStreams, [nodeId]: streamText } })
        }
        await delay(nodeStepDurationMs(node.type))
        metrics.addTokens(fakeTokensFor(node))
        return fakeOutputFor(node, get().userInput)
      }
    }
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

      let output: unknown
      try {
        if (get().liveMode) {
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
          }
          metrics.addTokens(fakeTokensFor(node))
        }
      } catch (error) {
        // Interrupted by stop/pause/restart: not a real failure — discard.
        if (token !== runToken) return
        // Genuine failure: pause without advancing, so Play retries this
        // node once the user has fixed the problem.
        const message = error instanceof Error ? error.message : String(error)
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

      // Stopped or restarted while this node was executing — discard.
      if (token !== runToken) return

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

      // Walk forward: routing nodes (condition/router/guardrail) follow only
      // the taken edge (marking the rest skipped); every other node fans out
      // to all flow targets.
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

      const errored = get().erroredNodeIds
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
      set({
        erroredNodeIds: errored.includes(nodeId)
          ? errored.filter((id) => id !== nodeId)
          : errored,
        nodeOutputs: { ...get().nodeOutputs, [nodeId]: output },
        nodeEngines: { ...get().nodeEngines, [nodeId]: engine },
        trace: [...get().trace, makeEntry('ok', output), ...skipEntries],
        executedIds: new Set(get().executedIds).add(nodeId),
        skippedNodeIds: skipped,
        executionQueue: nextQueue,
        currentNodeIndex: nextIndex,
        activeId: nextQueue[nextIndex] ?? null,
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
      pendingApproval: null,
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
    traceOpen: false,
    pendingApproval: null,

    setLiveMode: (liveMode) => set({ liveMode }),
    setUserInput: (userInput) => set({ userInput }),
    setTraceOpen: (traceOpen) => set({ traceOpen }),
    clearTrace: () => set({ trace: [] }),

    start: () => {
      const executionQueue = buildSeeds()
      if (executionQueue.length === 0) return
      runToken++
      set({ isActive: true })
      resetRunState(executionQueue)
      get().play()
    },

    stop: () => {
      runToken++
      abortInFlight()
      discardPendingStreams()
      visitCounts = new Map()
      joinDeferCounts = new Map()
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
        pendingApproval: null,
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
      set({
        pendingApproval: null,
        skippedNodeIds: skipped,
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
