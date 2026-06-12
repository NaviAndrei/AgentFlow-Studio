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
import { streamChat } from '../utils/llmClient'
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
  'loop',
  'humanInLoop',
  'supervisor',
  'swarmWorker',
  'retriever',
  'mcpServer',
  'structuredOutput',
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

  /** Outgoing edge identifiers of a node: the label when set, else the target id. */
  const outgoingIdentifiers = (nodeId: string): string[] =>
    useCanvasStore
      .getState()
      .edges.filter((e) => e.source === nodeId)
      .map((e) =>
        typeof e.label === 'string' && e.label !== '' ? e.label : e.target,
      )

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
        const config = useLLMConfigStore.getState().getConfig()
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
          model: node.data.model ?? 'gemini-flash',
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
        const lastAssistant = [...get().messages]
          .reverse()
          .find((m) => m.role === 'assistant')
        const content = lastAssistant?.content ?? ''
        const targets = outgoingIdentifiers(nodeId)
        // Heuristic: a substantive response takes the last (usually "done")
        // branch; an empty one takes the first.
        const taken =
          content.trim() !== ''
            ? (targets[targets.length - 1] ?? 'default')
            : (targets[0] ?? 'default')
        await delay(400)
        return {
          evaluated_on: truncate(content, 100),
          content_length: content.length,
          taken,
        }
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
            // Resolve the branch against the actual outgoing edges (instead
            // of the configured branch names) so the walker can map it to an
            // edge. First visit follows the first branch (loop-style
            // "continue"); a revisit takes the last (conventionally "done")
            // so cycles terminate.
            const targets = outgoingIdentifiers(nodeId)
            const visits = visitCounts.get(nodeId) ?? 1
            output = {
              evaluated: targets,
              taken:
                visits >= MAX_NODE_VISITS
                  ? (targets[targets.length - 1] ?? 'default')
                  : (targets[0] ?? 'default'),
            }
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

      // Walk forward: conditions follow only the taken edge (marking the
      // rest skipped); every other node fans out to all flow targets.
      let skipped = get().skippedNodeIds
      let nextTargets: string[]
      const skipEntries: TraceEntry[] = []
      if (node.type === 'condition') {
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
      })
      useSimulationMetricsStore.getState().resetAll()
    },

    play: () => {
      if (!get().isActive || get().isRunning || finished()) return
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
      if (!get().isActive || finished()) return
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
  }
})
