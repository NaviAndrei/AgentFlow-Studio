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

function abortInFlight() {
  abortController?.abort()
  abortController = null
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms))

function buildQueue(): string[] {
  const { nodes, edges } = useCanvasStore.getState()
  const flowNodes = nodes.filter(
    (n) => n.type !== undefined && SIMULATED_TYPES.includes(n.type),
  )
  const ids = new Set(flowNodes.map((n) => n.id))
  return topologicalSort(
    flowNodes.map((n) => n.id),
    edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  )
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

  /**
   * After a condition resolves, mark every node reachable only via its
   * non-taken branches as skipped. Nodes also reachable from the taken
   * branch (joins) or already executed (loop back-edges) are left alone.
   * Returns null when the taken value can't be matched to an edge.
   */
  const computeSkipped = (
    conditionId: string,
    taken: unknown,
  ): Set<string> | null => {
    if (typeof taken !== 'string') return null
    const { edges } = useCanvasStore.getState()
    const outs = edges.filter((e) => e.source === conditionId)
    if (outs.length < 2) return null
    const takenEdge = outs.find(
      (e) =>
        (typeof e.label === 'string' && e.label !== ''
          ? e.label
          : e.target) === taken,
    )
    if (!takenEdge) return null
    const reach = (from: string): Set<string> => {
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
    const takenReach = reach(takenEdge.target)
    const { executedIds, skippedNodeIds } = get()
    const skipped = new Set(skippedNodeIds)
    for (const out of outs) {
      if (out === takenEdge) continue
      for (const id of reach(out.target)) {
        if (takenReach.has(id)) continue
        if (id === conditionId || executedIds.has(id)) continue
        skipped.add(id)
      }
    }
    return skipped.size > skippedNodeIds.size ? skipped : null
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

      // A node on a branch the condition didn't take: log it as skipped and
      // move on without executing.
      if (get().skippedNodeIds.has(nodeId)) {
        set({
          trace: [
            ...get().trace,
            {
              id: crypto.randomUUID(),
              at: Date.now(),
              nodeId,
              nodeName: node.data.label,
              nodeType: node.type ?? 'unknown',
              status: 'skipped',
              durationMs: 0,
              input: '—',
              output: 'branch not taken',
            },
          ],
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
            // of the configured branch names) so the skip marking below can
            // map it to an edge. Mirrors the live heuristic: take the last
            // branch, conventionally the "done" path.
            const targets = outgoingIdentifiers(nodeId)
            output = {
              evaluated: targets,
              taken: targets[targets.length - 1] ?? 'default',
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

      let skippedNodeIds = get().skippedNodeIds
      if (node.type === 'condition') {
        const taken = (output as { taken?: unknown } | null)?.taken
        skippedNodeIds = computeSkipped(nodeId, taken) ?? skippedNodeIds
      }
      const errored = get().erroredNodeIds
      const nextIndex = get().currentNodeIndex + 1
      set({
        erroredNodeIds: errored.includes(nodeId)
          ? errored.filter((id) => id !== nodeId)
          : errored,
        nodeOutputs: { ...get().nodeOutputs, [nodeId]: output },
        nodeEngines: { ...get().nodeEngines, [nodeId]: engine },
        trace: [...get().trace, makeEntry('ok', output)],
        executedIds: new Set(get().executedIds).add(nodeId),
        skippedNodeIds,
        currentNodeIndex: nextIndex,
        activeId: executionQueue[nextIndex] ?? null,
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
      const executionQueue = buildQueue()
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
      resetRunState(buildQueue())
      get().play()
    },
  }
})
