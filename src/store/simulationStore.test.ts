import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge } from '@xyflow/react'
import { BLUEPRINTS } from '../blueprints'
import type {
  AgentFlowEdge,
  AgentFlowNode,
  AgentFlowNodeData,
  AgentFlowNodeType,
} from '../types'
import { useCanvasStore } from './canvasStore'
import { useEvalStore } from './evalStore'
import { useMemoryStore } from './memoryStore'
import { useSimulationStore } from './simulationStore'
import { useToastStore } from './toastStore'
import { useSimulationMetricsStore } from './simulationMetricsStore'
import { streamChat } from '../llm'

vi.mock('../llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm')>()
  return { ...actual, streamChat: vi.fn() }
})

function node(
  id: string,
  type: AgentFlowNodeType,
  data?: Partial<AgentFlowNodeData>,
): AgentFlowNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } }
}

function edge(source: string, target: string, label?: string): Edge {
  const e: Edge = { id: `${source}->${target}`, source, target }
  if (label !== undefined) e.label = label
  return e
}

function loadGraph(nodes: AgentFlowNode[], edges: Edge[]): void {
  useCanvasStore.setState({ nodes, edges })
}

/** Run the simulation to completion (timers are instant in tests). */
async function runToEnd(): Promise<ReturnType<typeof useSimulationStore.getState>> {
  useSimulationStore.getState().start()
  await vi.waitFor(() => {
    const s = useSimulationStore.getState()
    expect(s.executionQueue.length).toBeGreaterThan(0)
    expect(s.currentNodeIndex).toBeGreaterThanOrEqual(s.executionQueue.length)
    expect(s.isRunning).toBe(false)
  })
  return useSimulationStore.getState()
}

/** Start a run and wait until it halts at a Human-in-Loop gate. */
async function runUntilPending(): Promise<
  ReturnType<typeof useSimulationStore.getState>
> {
  useSimulationStore.getState().start()
  await vi.waitFor(() => {
    expect(useSimulationStore.getState().pendingApproval).not.toBeNull()
  })
  return useSimulationStore.getState()
}

beforeEach(() => {
  useSimulationStore.getState().stop()
  useSimulationStore.getState().setLiveMode(false)
  vi.mocked(streamChat).mockReset()
  vi.mocked(streamChat).mockResolvedValue('(mock live reply)')
})

describe('simulation queue walker — condition predicates', () => {
  // Diamond: start → cond, cond →(yes) a → out, cond →(no) b → out.
  // Branch names equal the outgoing edge labels and act as substring
  // predicates over the content (here, the user input).
  const diamond = (input: string) => {
    loadGraph(
      [
        node('s', 'start'),
        node('c', 'condition', { branches: ['yes', 'no'] }),
        node('a', 'llm'),
        node('b', 'tool'),
        node('o', 'output'),
      ],
      [
        edge('s', 'c'),
        edge('c', 'a', 'yes'),
        edge('c', 'b', 'no'),
        edge('a', 'o'),
        edge('b', 'o'),
      ],
    )
    useSimulationStore.getState().setUserInput(input)
  }

  it('takes the branch whose predicate matches and skip-marks the other', async () => {
    diamond('yes please')
    const s = await runToEnd()
    expect(s.executionQueue).toEqual(['s', 'c', 'a', 'o'])
    expect([...s.executedIds].sort()).toEqual(['a', 'c', 'o', 's'])
    expect([...s.skippedNodeIds]).toEqual(['b'])
    expect(s.nodeOutputs.c).toMatchObject({ taken: 'yes', matched: true })
  })

  it('falls through to the else branch when no predicate matches', async () => {
    diamond('nothing relevant here')
    const s = await runToEnd()
    // "no" is the else (last) branch → b runs, a is skipped.
    expect(s.executedIds.has('b')).toBe(true)
    expect(s.skippedNodeIds.has('a')).toBe(true)
    expect(s.nodeOutputs.c).toMatchObject({ taken: 'no', matched: false })
  })

  it('records a skipped trace entry instead of executing the branch', async () => {
    diamond('yes please')
    const s = await runToEnd()
    const bEntries = s.trace.filter((t) => t.nodeId === 'b')
    expect(bEntries).toHaveLength(1)
    expect(bEntries[0].status).toBe('skipped')
    expect(s.trace.filter((t) => t.status === 'ok')).toHaveLength(4)
    expect(s.nodeOutputs).not.toHaveProperty('b')
  })

  it('does not skip a join node shared by both branches', async () => {
    diamond('yes please')
    const s = await runToEnd()
    expect(s.skippedNodeIds.has('o')).toBe(false)
    expect(s.executedIds.has('o')).toBe(true)
  })
})

describe('simulation queue walker — router by keyword', () => {
  const triage = () =>
    loadGraph(
      [
        node('s', 'start'),
        node('r', 'router', { routes: ['billing', 'tech'] }),
        node('b', 'llm', { label: 'Billing' }),
        node('t', 'llm', { label: 'Tech' }),
        node('o', 'output'),
      ],
      [
        edge('s', 'r'),
        edge('r', 'b', 'billing'),
        edge('r', 't', 'tech'),
        edge('b', 'o'),
        edge('t', 'o'),
      ],
    )

  it('routes to the branch whose name matches the user input', async () => {
    triage()
    useSimulationStore.getState().setUserInput('my billing is broken')
    const s = await runToEnd()
    expect(s.nodeOutputs.r).toMatchObject({ taken: 'billing', matched_on: 'billing' })
    expect(s.executedIds.has('b')).toBe(true)
    expect(s.skippedNodeIds.has('t')).toBe(true)
  })

  it('falls back to the first route when nothing matches', async () => {
    triage()
    useSimulationStore.getState().setUserInput('hello there')
    const s = await runToEnd()
    expect(s.nodeOutputs.r).toMatchObject({ taken: 'billing', matched_on: null })
  })
})

describe('simulation queue walker — guardrail keyword check', () => {
  it('takes the fail edge and skip-marks the pass subtree when no keyword matches', async () => {
    loadGraph(
      [
        node('s', 'start'),
        node('g', 'guardrail', { checkType: 'keyword', criteria: 'refund' }),
        node('p', 'output', { label: 'Pass' }),
        node('f', 'llm', { label: 'Fail' }),
      ],
      [edge('s', 'g'), edge('g', 'p', 'pass'), edge('g', 'f', 'fail')],
    )
    // No message or input matches the criteria → fail.
    const s = await runToEnd()
    expect(s.nodeOutputs.g).toMatchObject({ taken: 'fail' })
    expect(s.executedIds.has('f')).toBe(true)
    expect(s.skippedNodeIds.has('p')).toBe(true)
  })

  it('passes when the user input matches a criterion keyword', async () => {
    loadGraph(
      [
        node('s', 'start'),
        node('g', 'guardrail', { checkType: 'keyword', criteria: 'context' }),
        node('p', 'output', { label: 'Pass' }),
        node('f', 'llm', { label: 'Fail' }),
      ],
      [edge('s', 'g'), edge('g', 'p', 'pass'), edge('g', 'f', 'fail')],
    )
    useSimulationStore.getState().setUserInput('please use the context provided')
    const s = await runToEnd()
    expect(s.nodeOutputs.g).toMatchObject({ taken: 'pass', matched: 'context' })
    expect(s.executedIds.has('p')).toBe(true)
    expect(s.skippedNodeIds.has('f')).toBe(true)
  })
})

describe('simulation metrics — monotonic step total', () => {
  it('never lets the step total shrink within a run', () => {
    const metrics = useSimulationMetricsStore.getState()
    metrics.resetAll()
    metrics.setStep(0, 4)
    metrics.setStep(1, 6) // queue grew as targets were discovered
    metrics.setStep(2, 5) // a join re-queue reported a smaller total
    expect(useSimulationMetricsStore.getState().stepTotal).toBe(6)
    expect(useSimulationMetricsStore.getState().stepIndex).toBe(2)
  })
})

describe('simulation queue walker — join barrier', () => {
  // Diamond into a join: s → a → j, s → b → j, j → o
  const diamondJoin = (strategy: 'concat' | 'last' = 'concat') =>
    loadGraph(
      [
        node('s', 'start'),
        node('a', 'llm', { label: 'A' }),
        node('b', 'tool', { label: 'B' }),
        node('j', 'join', { mergeStrategy: strategy }),
        node('o', 'output'),
      ],
      [
        edge('s', 'a'),
        edge('s', 'b'),
        edge('a', 'j'),
        edge('b', 'j'),
        edge('j', 'o'),
      ],
    )

  it('waits for both branches before executing the join', async () => {
    diamondJoin()
    const s = await runToEnd()
    const order = s.trace
      .filter((t) => t.status === 'ok')
      .map((t) => t.nodeId)
    // The join executes only after both a and b.
    expect(order.indexOf('j')).toBeGreaterThan(order.indexOf('a'))
    expect(order.indexOf('j')).toBeGreaterThan(order.indexOf('b'))
    expect(s.executedIds.has('j')).toBe(true)
    expect(s.executedIds.has('o')).toBe(true)
  })

  it('merges both branch outputs with concat', async () => {
    diamondJoin('concat')
    const s = await runToEnd()
    expect(s.nodeOutputs.j).toMatchObject({ strategy: 'concat', waited_for: 2 })
    expect((s.nodeOutputs.j as { merged: unknown[] }).merged).toHaveLength(2)
  })

  it('executes the join only once despite two incoming branches', async () => {
    diamondJoin()
    const s = await runToEnd()
    expect(s.trace.filter((t) => t.nodeId === 'j' && t.status === 'ok')).toHaveLength(1)
  })

  it('still completes when one branch is skipped by a condition', async () => {
    // s → c, c→(yes) a → j, c→(no) b → j, j → o. The "no" branch is skipped.
    loadGraph(
      [
        node('s', 'start'),
        node('c', 'condition', { branches: ['yes', 'no'] }),
        node('a', 'llm', { label: 'A' }),
        node('b', 'tool', { label: 'B' }),
        node('j', 'join'),
        node('o', 'output'),
      ],
      [
        edge('s', 'c'),
        edge('c', 'a', 'yes'),
        edge('c', 'b', 'no'),
        edge('a', 'j'),
        edge('b', 'j'),
        edge('j', 'o'),
      ],
    )
    // "yes" predicate matches → a runs, b (the else branch) is skipped.
    useSimulationStore.getState().setUserInput('yes please')
    const s = await runToEnd()
    expect(s.skippedNodeIds.has('b')).toBe(true)
    // The join waits only on the live branch and still runs.
    expect(s.executedIds.has('j')).toBe(true)
    expect(s.executedIds.has('o')).toBe(true)
    expect(s.nodeOutputs.j).toMatchObject({ waited_for: 1 })
  })
})

describe('simulation queue walker — loop semantics', () => {
  // ReAct-style loop: start → cond, cond →(continue) a → cond, cond →(done) b.
  // The input matches the "continue" predicate, so the loop iterates once and
  // the forced-else on the final visit takes "done" and terminates it.
  const loop = (input: string) => {
    loadGraph(
      [
        node('s', 'start'),
        node('c', 'condition', { branches: ['continue', 'done'] }),
        node('a', 'llm'),
        node('b', 'output'),
      ],
      [
        edge('s', 'c'),
        edge('c', 'a', 'continue'),
        edge('c', 'b', 'done'),
        edge('a', 'c'),
      ],
    )
    useSimulationStore.getState().setUserInput(input)
  }

  it('loops while the predicate matches, then the forced else terminates it', async () => {
    loop('please continue')
    const s = await runToEnd()
    expect(s.executionQueue).toEqual(['s', 'c', 'a', 'c', 'b'])
    const condRuns = s.trace.filter((t) => t.nodeId === 'c' && t.status === 'ok')
    expect(condRuns).toHaveLength(2)
    expect(condRuns[0].output).toContain('"taken":"continue"')
    // The second (final) visit is forced to the else branch.
    expect(condRuns[1].output).toContain('"taken":"done"')
    expect(condRuns[1].output).toContain('"forced_else":true')
  })

  it('still terminates when the predicate always matches', async () => {
    // "continue" matches on every visit; only the visit budget + forced else
    // stop the cycle. The run must end, not hang.
    loop('continue continue continue')
    const s = await runToEnd()
    expect(s.isRunning).toBe(false)
    expect(s.executedIds.has('b')).toBe(true)
  })

  it('does not skip-mark loop members reachable from the taken path', async () => {
    loop('please continue')
    const s = await runToEnd()
    expect(s.skippedNodeIds.size).toBe(0)
  })
})

describe('simulation — forkFromSnapshot', () => {
  // Same ReAct-style loop fixture as the loop-semantics block above:
  // start → cond, cond →(continue) a → cond, cond →(done) b.
  const loop = (input: string) => {
    loadGraph(
      [
        node('s', 'start'),
        node('c', 'condition', { branches: ['continue', 'done'] }),
        node('a', 'llm'),
        node('b', 'output'),
      ],
      [
        edge('s', 'c'),
        edge('c', 'a', 'continue'),
        edge('c', 'b', 'done'),
        edge('a', 'c'),
      ],
    )
    useSimulationStore.getState().setUserInput(input)
  }

  it('forks from the very first snapshot (step 0) and re-runs the whole graph', async () => {
    loop('please continue')
    const original = await runToEnd()
    expect(original.snapshots.length).toBeGreaterThan(0)

    useSimulationStore.getState().forkFromSnapshot(original.snapshots, 0)
    await vi.waitFor(() => {
      const st = useSimulationStore.getState()
      expect(st.currentNodeIndex).toBeGreaterThanOrEqual(st.executionQueue.length)
    })
    const s = useSimulationStore.getState()
    // Nothing was seeded (stepIndex 0 has no prior steps), so every node —
    // including the fork target itself — was freshly (re-)executed.
    expect(s.executedIds.has('s')).toBe(true)
    expect(s.executedIds.has('b')).toBe(true)
    expect(s.trace.some((t) => t.nodeId === 's')).toBe(true)
  })

  it('mid-run fork seeds pre-fork nodes as executed and starts the fork node clean', async () => {
    loop('please continue')
    const original = await runToEnd()
    // executionQueue is [s, c, a, c, b]; fork from the 'a' step (index 2).
    expect(original.executionQueue[2]).toBe('a')

    useSimulationStore.getState().forkFromSnapshot(original.snapshots, 2)
    await vi.waitFor(() => {
      const st = useSimulationStore.getState()
      expect(st.currentNodeIndex).toBeGreaterThanOrEqual(st.executionQueue.length)
    })
    const s = useSimulationStore.getState()
    // Pre-fork nodes (s, c) are seeded as already executed and are NOT
    // re-run (no fresh trace entry); the fork node ('a') starts clean and
    // does get a fresh trace entry.
    expect(s.executedIds.has('s')).toBe(true)
    expect(s.executedIds.has('c')).toBe(true)
    expect(s.trace.some((t) => t.nodeId === 's')).toBe(false)
    expect(s.executedIds.has('a')).toBe(true)
    expect(s.trace.some((t) => t.nodeId === 'a')).toBe(true)
  })

  it('carries visit counts over so the loop budget still forces termination', async () => {
    loop('please continue')
    const original = await runToEnd()
    // executionQueue is [s, c, a, c, b]; the second 'c' (index 3) is the
    // forced-else visit that ends the loop in the original run.
    expect(original.executionQueue[3]).toBe('c')

    // Fork from just before that second 'c' visit, seeding one prior visit
    // each to s/c/a via the pre-fork snapshots.
    useSimulationStore.getState().forkFromSnapshot(original.snapshots, 3)

    await vi.waitFor(() => {
      const st = useSimulationStore.getState()
      expect(st.currentNodeIndex).toBeGreaterThanOrEqual(st.executionQueue.length)
    })
    const s = useSimulationStore.getState()
    // If the carried-over visit count were dropped, this fresh 'c' execution
    // would not hit MAX_NODE_VISITS and would take "continue" again instead
    // of being forced to "done" — the run would not reach 'b'.
    const secondCondRun = s.trace.find(
      (t) => t.nodeId === 'c' && t.status === 'ok' && t.output?.includes('forced_else'),
    )
    expect(secondCondRun).toBeDefined()
    expect(s.executedIds.has('b')).toBe(true)
  })
})

describe('simulation — human-in-loop gate', () => {
  const gated = () =>
    loadGraph(
      [node('s', 'start'), node('h', 'humanInLoop'), node('o', 'output')],
      [edge('s', 'h'), edge('h', 'o')],
    )

  it('halts at the gate with the node already recorded', async () => {
    gated()
    const s = await runUntilPending()
    expect(s.pendingApproval).toEqual({ nodeId: 'h' })
    expect(s.isRunning).toBe(false)
    // The gate node itself ran; the downstream has not.
    expect(s.executedIds.has('h')).toBe(true)
    expect(s.executedIds.has('o')).toBe(false)
  })

  it('resumes and runs the downstream on approve', async () => {
    gated()
    await runUntilPending()
    useSimulationStore.getState().approve()
    await vi.waitFor(() => {
      const st = useSimulationStore.getState()
      expect(st.currentNodeIndex).toBeGreaterThanOrEqual(st.executionQueue.length)
    })
    const s = useSimulationStore.getState()
    expect(s.pendingApproval).toBeNull()
    expect(s.executedIds.has('o')).toBe(true)
    expect(s.nodeOutputs.h).toMatchObject({ approved: true })
  })

  it('skips the downstream, marks the gate errored, and ends the run on reject', async () => {
    gated()
    await runUntilPending()
    useSimulationStore.getState().reject()
    const s = useSimulationStore.getState()
    expect(s.pendingApproval).toBeNull()
    expect(s.skippedNodeIds.has('o')).toBe(true)
    expect(s.executedIds.has('o')).toBe(false)
    expect(s.nodeOutputs.h).toMatchObject({ approved: false })
    expect(s.erroredNodeIds).toContain('h')
  })

  it('resumes and injects the typed response on submitHumanInput', async () => {
    gated()
    await runUntilPending()
    useSimulationStore.getState().submitHumanInput('looks good, proceed')
    await vi.waitFor(() => {
      const st = useSimulationStore.getState()
      expect(st.currentNodeIndex).toBeGreaterThanOrEqual(st.executionQueue.length)
    })
    const s = useSimulationStore.getState()
    expect(s.pendingApproval).toBeNull()
    expect(s.executedIds.has('o')).toBe(true)
    expect(s.nodeOutputs.h).toMatchObject({
      approved: true,
      userResponse: 'looks good, proceed',
    })
  })

  it('ignores step while awaiting approval', async () => {
    gated()
    const s = await runUntilPending()
    const before = s.currentNodeIndex
    useSimulationStore.getState().step()
    expect(useSimulationStore.getState().currentNodeIndex).toBe(before)
    expect(useSimulationStore.getState().executedIds.has('o')).toBe(false)
  })

  it('clears the pending gate on stop', async () => {
    gated()
    await runUntilPending()
    useSimulationStore.getState().stop()
    expect(useSimulationStore.getState().pendingApproval).toBeNull()
  })
})

describe('simulation queue walker — MAX_NODE_VISITS budget', () => {
  it('bounds a pure two-node cycle to two visits per node', async () => {
    loadGraph(
      [node('a', 'llm'), node('b', 'tool')],
      [edge('a', 'b'), edge('b', 'a')],
    )
    const s = await runToEnd()
    // Each node enqueued at most MAX_NODE_VISITS (2) times, then the run ends.
    expect(s.executionQueue).toEqual(['a', 'b', 'a', 'b'])
    const visits = (id: string) =>
      s.trace.filter((t) => t.nodeId === id && t.status === 'ok').length
    expect(visits('a')).toBe(2)
    expect(visits('b')).toBe(2)
  })

  it('never enqueues the same pending node twice', async () => {
    // Two parallel paths converging: s → a → o and s → b → o.
    loadGraph(
      [node('s', 'start'), node('a', 'llm'), node('b', 'tool'), node('o', 'output')],
      [edge('s', 'a'), edge('s', 'b'), edge('a', 'o'), edge('b', 'o')],
    )
    const s = await runToEnd()
    expect(s.executionQueue).toEqual(['s', 'a', 'b', 'o'])
    expect(s.trace.filter((t) => t.nodeId === 'o')).toHaveLength(1)
  })
})

describe('simulation queue walker — Map per-item virtual branches', () => {
  // s → m → b → j → o. The Map expands the body (b) into one virtual branch
  // per item; each branch's virtual terminal becomes a join source so the
  // join waits for all N to finish.
  const mapGraph = (mapData: Partial<AgentFlowNodeData>) =>
    loadGraph(
      [
        node('s', 'start'),
        node('m', 'map', mapData),
        node('b', 'llm', { label: 'Body' }),
        node('j', 'join', { mergeStrategy: 'concat' }),
        node('o', 'output'),
      ],
      [
        edge('s', 'm'),
        edge('m', 'b'),
        edge('b', 'j'),
        edge('j', 'o'),
      ],
    )

  it('spawns one virtual branch per item when mapItems is set', async () => {
    mapGraph({ mapItems: ['x', 'y', 'z'] })
    const s = await runToEnd()
    expect(s.nodeOutputs['b__map_0']).toBeDefined()
    expect(s.nodeOutputs['b__map_1']).toBeDefined()
    expect(s.nodeOutputs['b__map_2']).toBeDefined()
    // The real body node is replaced by virtuals — it should be skip-marked.
    expect(s.skippedNodeIds.has('b')).toBe(true)
    expect(s.executedIds.has('b')).toBe(false)
  })

  it('injects _mapItem and _mapIndex into each virtual branch output', async () => {
    mapGraph({ mapItems: ['x', 'y', 'z'] })
    const s = await runToEnd()
    expect((s.nodeOutputs['b__map_0'] as { _mapItem: string })._mapItem).toBe('x')
    expect((s.nodeOutputs['b__map_0'] as { _mapIndex: number })._mapIndex).toBe(0)
    expect((s.nodeOutputs['b__map_2'] as { _mapItem: string })._mapItem).toBe('z')
    expect((s.nodeOutputs['b__map_2'] as { _mapIndex: number })._mapIndex).toBe(2)
  })

  it('downstream Join fires only after all N virtual branches complete', async () => {
    mapGraph({ mapItems: ['x', 'y', 'z'] })
    const s = await runToEnd()
    // Join executed exactly once and waited for all 3 virtual branches.
    const jRuns = s.trace.filter((t) => t.nodeId === 'j' && t.status === 'ok')
    expect(jRuns).toHaveLength(1)
    const jOut = s.nodeOutputs.j as { waited_for: number; merged: unknown[] }
    expect(jOut.waited_for).toBe(3)
    expect(jOut.merged).toHaveLength(3)
    // Every virtual branch ran before the join.
    const okOrder = s.trace
      .filter((t) => t.status === 'ok')
      .map((t) => t.nodeId)
    for (const vid of ['b__map_0', 'b__map_1', 'b__map_2']) {
      expect(okOrder.indexOf(vid)).toBeLessThan(okOrder.indexOf('j'))
    }
    expect(s.executedIds.has('o')).toBe(true)
  })

  it('does not leak virtual node state between runs after Stop', async () => {
    mapGraph({ mapItems: ['x', 'y', 'z'] })
    await runToEnd()
    useSimulationStore.getState().stop()
    // Subsequent simple run must show no leftover __map_ ids in trace/outputs.
    loadGraph(
      [node('s', 'start'), node('o', 'output')],
      [edge('s', 'o')],
    )
    const s = await runToEnd()
    expect(s.trace.every((t) => !t.nodeId.includes('__map_'))).toBe(true)
    expect(
      Object.keys(s.nodeOutputs).every((id) => !id.includes('__map_')),
    ).toBe(true)
  })

  it('defaults to 3 branches when neither mapItems nor mapCount is set', async () => {
    mapGraph({})
    const s = await runToEnd()
    expect(s.nodeOutputs['b__map_0']).toBeDefined()
    expect(s.nodeOutputs['b__map_1']).toBeDefined()
    expect(s.nodeOutputs['b__map_2']).toBeDefined()
    expect(s.nodeOutputs['b__map_3']).toBeUndefined()
    expect((s.nodeOutputs['b__map_0'] as { _mapItem: string })._mapItem).toBe(
      'item_1',
    )
  })
})

describe('simulation queue walker — Subgraph nested execution', () => {
  it('runs the inner graph of a configured subgraph (Hierarchical Teams)', async () => {
    const bp = BLUEPRINTS.find((b) => b.id === 'hierarchical-teams')
    if (!bp) throw new Error('missing hierarchical-teams blueprint')
    loadGraph(
      bp.nodes as unknown as AgentFlowNode[],
      bp.edges as unknown as AgentFlowEdge[],
    )
    useSimulationStore.getState().setUserInput('Write a brief on agent frameworks')
    const s = await runToEnd()

    for (const subgraphId of ['subgraph-1', 'subgraph-2']) {
      const out = s.nodeOutputs[subgraphId] as Record<string, unknown>
      // Not the empty stub: the inner graph actually ran.
      expect(out).not.toMatchObject({ subgraph_ran: true, summary: expect.any(String) })
      expect(typeof out._innerStepCount).toBe('number')
      expect(out._innerStepCount as number).toBeGreaterThan(0)

      const nested = s.trace.filter((t) => t.parentNodeId === subgraphId)
      expect(nested.length).toBeGreaterThan(0)
    }
  })

  it('completes without throwing for an empty subgraphRef', async () => {
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: '' }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    const s = await runToEnd()
    expect(s.nodeOutputs.sg).toMatchObject({ ran: true })
    expect(s.trace.some((t) => t.status === 'error')).toBe(false)
  })

  it('reports an error output for an invalid subgraphRef', async () => {
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: 'not valid json {' }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    const s = await runToEnd()
    expect(s.nodeOutputs.sg).toMatchObject({ subgraph_ran: false })
    expect((s.nodeOutputs.sg as { error: string }).error).toContain('Invalid subgraphRef')
  })

  it('discards stale nested trace entries when stopped mid-run', async () => {
    const innerRef = JSON.stringify({
      nodes: [
        { id: 'inner-s', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Inner Start' } },
        { id: 'inner-o', type: 'output', position: { x: 0, y: 0 }, data: { label: 'Inner Output' } },
      ],
      edges: [{ id: 'ie1', source: 'inner-s', target: 'inner-o' }],
    })
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: innerRef }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    useSimulationStore.getState().start()
    useSimulationStore.getState().stop()
    await vi.waitFor(() => {
      expect(useSimulationStore.getState().isActive).toBe(false)
    })
    const s = useSimulationStore.getState()
    expect(s.trace.some((t) => t.parentNodeId === 'sg')).toBe(false)
    expect(s.executionQueue).toEqual([])
  })
})

describe('simulation queue walker — Subgraph live execution', () => {
  const llmInnerRef = JSON.stringify({
    nodes: [
      { id: 'inner-s', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Inner Start' } },
      { id: 'inner-llm', type: 'llm', position: { x: 0, y: 0 }, data: { label: 'Inner LLM' } },
      { id: 'inner-o', type: 'output', position: { x: 0, y: 0 }, data: { label: 'Inner Output' } },
    ],
    edges: [
      { id: 'ie1', source: 'inner-s', target: 'inner-llm' },
      { id: 'ie2', source: 'inner-llm', target: 'inner-o' },
    ],
  })

  const agentInnerRef = JSON.stringify({
    nodes: [
      { id: 'inner-s', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Inner Start' } },
      { id: 'inner-agent', type: 'agent', position: { x: 0, y: 0 }, data: { label: 'Inner Agent' } },
      { id: 'inner-o', type: 'output', position: { x: 0, y: 0 }, data: { label: 'Inner Output' } },
    ],
    edges: [
      { id: 'ie1', source: 'inner-s', target: 'inner-agent' },
      { id: 'ie2', source: 'inner-agent', target: 'inner-o' },
    ],
  })

  it('liveMode false: always uses fakeOutputFor, never calls streamChat', async () => {
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: llmInnerRef }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    const s = await runToEnd()
    expect(streamChat).not.toHaveBeenCalled()
    const innerLlmEntry = s.trace.find((t) => t.nodeId === 'inner-llm')
    expect(innerLlmEntry?.engine).toBe('simulated')
  })

  it('liveMode true: calls streamChat exactly once for the inner llm node', async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: llmInnerRef }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    const s = await runToEnd()
    expect(streamChat).toHaveBeenCalledTimes(1)
    const innerLlmEntry = s.trace.find((t) => t.nodeId === 'inner-llm')
    expect(innerLlmEntry?.engine).toBe('live')
  })

  it('liveMode true: inner node type in SIMULATED_TYPES (agent) still uses fakeOutputFor', async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: agentInnerRef }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    const s = await runToEnd()
    expect(streamChat).not.toHaveBeenCalled()
    const innerAgentEntry = s.trace.find((t) => t.nodeId === 'inner-agent')
    expect(innerAgentEntry?.engine).toBe('simulated')
  })

  it('aborts cleanly when the run is stopped mid live inner call', async () => {
    vi.mocked(streamChat).mockImplementation(async () => {
      useSimulationStore.getState().stop()
      return '(late reply)'
    })
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: llmInnerRef }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    useSimulationStore.getState().start()
    await vi.waitFor(() => {
      expect(useSimulationStore.getState().isActive).toBe(false)
    })
    const s = useSimulationStore.getState()
    expect(s.nodeOutputs.sg).toBeUndefined()
    expect(s.executedIds.has('sg')).toBe(false)
    expect(s.trace.some((t) => t.nodeId === 'inner-llm')).toBe(false)
    expect(s.executionQueue).toEqual([])
  })

  it('appendToParent false (default): parent transcript is unaffected by the inner run', async () => {
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: llmInnerRef }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    const s = await runToEnd()
    // Only the Start node's seed message is present — no assistant turn was
    // appended from the inner subgraph run.
    expect(s.messages.every((m) => m.role !== 'assistant')).toBe(true)
  })

  it('appendToParent true: appends one assistant message from the inner run', async () => {
    loadGraph(
      [
        node('s', 'start'),
        node('sg', 'subgraph', { subgraphRef: llmInnerRef, appendToParent: true }),
        node('o', 'output'),
      ],
      [edge('s', 'sg'), edge('sg', 'o')],
    )
    const s = await runToEnd()
    expect(s.messages[s.messages.length - 1]?.role).toBe('assistant')
  })
})

describe('simulation queue walker — node output caching', () => {
  const linear = () =>
    loadGraph(
      [node('s', 'start'), node('t', 'tool', { toolName: 'fetch' }), node('o', 'output')],
      [edge('s', 't'), edge('t', 'o')],
    )

  it('clearHashCache resets all cached entries', () => {
    useSimulationStore.getState().setCachedHash('x', 'abc123')
    expect(useSimulationStore.getState().nodeInputHashCache.get('x')).toBe('abc123')
    useSimulationStore.getState().clearHashCache()
    expect(useSimulationStore.getState().nodeInputHashCache.size).toBe(0)
  })

  it('caches node output on identical re-run', async () => {
    linear()
    const s1 = await runToEnd()
    expect(s1.trace.filter((t) => t.status === 'ok')).toHaveLength(3)

    const s2 = await runToEnd()
    const cached = s2.trace.filter((t) => t.status === 'cached')
    expect(cached.map((t) => t.nodeId).sort()).toEqual(['o', 's', 't'])
    expect(cached.every((t) => t.durationMs === 0)).toBe(true)
    expect(s2.trace.filter((t) => t.status === 'ok')).toHaveLength(0)
  })

  it('re-executes node when upstream output changes', async () => {
    linear()
    await runToEnd()

    useCanvasStore.getState().updateNodeData('t', { toolName: 'different-tool' })
    const s2 = await runToEnd()

    const statusOf = (id: string) =>
      s2.trace.find((t) => t.nodeId === id)?.status
    expect(statusOf('s')).toBe('cached')
    expect(statusOf('t')).toBe('ok')
    expect(statusOf('o')).toBe('ok')
  })

  it('clearHashCache forces full re-execution on the next run', async () => {
    linear()
    await runToEnd()

    useSimulationStore.getState().clearHashCache()
    const s2 = await runToEnd()

    expect(s2.trace.filter((t) => t.status === 'cached')).toHaveLength(0)
    expect(s2.trace.filter((t) => t.status === 'ok')).toHaveLength(3)
  })
})
describe('start() unguarded-cycle warning', () => {
  it('pushes a warning toast for an unguarded all-agent cycle but does not block execution', () => {
    loadGraph(
      [node('a', 'agent'), node('b', 'agent'), node('c', 'agent')],
      [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
    )
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')
    pushToast.mockClear()

    useSimulationStore.getState().start()

    expect(pushToast).toHaveBeenCalledTimes(1)
    const [message, tone] = pushToast.mock.calls[0]
    expect(message).toContain('Unguarded cycle')
    expect(tone).toBe('warning')
    expect(useSimulationStore.getState().isActive).toBe(true)
  })

  it('does not warn when a router node sits on the cycle path', () => {
    loadGraph(
      [node('a', 'agent'), node('b', 'router', { routes: ['x'] }), node('c', 'agent')],
      [edge('a', 'b'), edge('b', 'c', 'x'), edge('c', 'a')],
    )
    const pushToast = vi.spyOn(useToastStore.getState(), 'pushToast')
    pushToast.mockClear()

    useSimulationStore.getState().start()

    expect(pushToast).not.toHaveBeenCalled()
    expect(useSimulationStore.getState().isActive).toBe(true)
  })
})

describe("executeLiveNode â default branch real LLM", () => {
  it("calls streamChat with the node's model and system prompt, and surfaces temperature in the output", async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node("s", "start"),
        node("a", "agent", {
          model: "custom-model",
          systemPrompt: "Be the agent.",
          temperature: 0.3,
        }),
        node("o", "output"),
      ],
      [edge("s", "a"), edge("a", "o")],
    )
    const s = await runToEnd()

    expect(streamChat).toHaveBeenCalledTimes(1)
    const [config, chat] = vi.mocked(streamChat).mock.calls[0]
    expect(config.settings.model).toBe("custom-model")
    expect(chat[0]).toEqual({ role: "system", content: "Be the agent." })
    expect(s.nodeOutputs.a).toMatchObject({ model: "custom-model", temperature: 0.3 })
  })

  it("on streamChat rejection, pushes a warning toast and keeps the run from crashing", async () => {
    vi.mocked(streamChat).mockRejectedValue(new Error("provider unreachable"))
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [node("s", "start"), node("a", "agent"), node("o", "output")],
      [edge("s", "a"), edge("a", "o")],
    )
    const pushToast = vi.spyOn(useToastStore.getState(), "pushToast")
    pushToast.mockClear()

    const s = await runToEnd()

    expect(pushToast).toHaveBeenCalledTimes(1)
    const [message, tone] = pushToast.mock.calls[0]
    expect(message).toContain("provider unreachable")
    expect(tone).toBe("warning")
    expect(s.nodeOutputs.a).toMatchObject({ error: "provider unreachable" })
    expect(useSimulationStore.getState().isActive).toBe(true)
  })

  it("adds the real token count from the streamChat response to metrics", async () => {
    vi.mocked(streamChat).mockResolvedValue("a reasonably long reply for token estimation")
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [node("s", "start"), node("a", "agent"), node("o", "output")],
      [edge("s", "a"), edge("a", "o")],
    )

    await runToEnd()

    expect(useSimulationMetricsStore.getState().tokens).toBeGreaterThan(0)
  })
})
describe("executeLiveNode â tool/retriever branches real LLM", () => {
  it("tool: calls streamChat with the node's model and system prompt", async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node("s", "start"),
        node("t", "tool", {
          model: "tool-model",
          systemPrompt: "Use the search tool.",
        }),
        node("o", "output"),
      ],
      [edge("s", "t"), edge("t", "o")],
    )
    const s = await runToEnd()

    expect(streamChat).toHaveBeenCalledTimes(1)
    const [config, chat] = vi.mocked(streamChat).mock.calls[0]
    expect(config.settings.model).toBe("tool-model")
    expect(chat[0]).toEqual({ role: "system", content: "Use the search tool." })
    expect(s.nodeOutputs.t).toMatchObject({ model: "tool-model" })
  })

  it("tool: on streamChat rejection, pushes a warning toast and keeps the run from crashing", async () => {
    vi.mocked(streamChat).mockRejectedValue(new Error("tool provider unreachable"))
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [node("s", "start"), node("t", "tool"), node("o", "output")],
      [edge("s", "t"), edge("t", "o")],
    )
    const pushToast = vi.spyOn(useToastStore.getState(), "pushToast")
    pushToast.mockClear()

    const s = await runToEnd()

    expect(pushToast).toHaveBeenCalledTimes(1)
    const [message, tone] = pushToast.mock.calls[0]
    expect(message).toContain("tool provider unreachable")
    expect(tone).toBe("warning")
    expect(s.nodeOutputs.t).toMatchObject({ error: "tool provider unreachable" })
    expect(useSimulationStore.getState().isActive).toBe(true)
  })

  it("retriever: calls streamChat with the node's model and system prompt", async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node("s", "start"),
        node("r", "retriever", {
          model: "retriever-model",
          systemPrompt: "Retrieve relevant documents.",
        }),
        node("o", "output"),
      ],
      [edge("s", "r"), edge("r", "o")],
    )
    const s = await runToEnd()

    expect(streamChat).toHaveBeenCalledTimes(1)
    const [config, chat] = vi.mocked(streamChat).mock.calls[0]
    expect(config.settings.model).toBe("retriever-model")
    expect(chat[0]).toEqual({ role: "system", content: "Retrieve relevant documents." })
    expect(s.nodeOutputs.r).toMatchObject({ model: "retriever-model" })
  })

  it("retriever: on streamChat rejection, pushes a warning toast and keeps the run from crashing", async () => {
    vi.mocked(streamChat).mockRejectedValue(new Error("retriever provider unreachable"))
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [node("s", "start"), node("r", "retriever"), node("o", "output")],
      [edge("s", "r"), edge("r", "o")],
    )
    const pushToast = vi.spyOn(useToastStore.getState(), "pushToast")
    pushToast.mockClear()

    const s = await runToEnd()

    expect(pushToast).toHaveBeenCalledTimes(1)
    const [message, tone] = pushToast.mock.calls[0]
    expect(message).toContain("retriever provider unreachable")
    expect(tone).toBe("warning")
    expect(s.nodeOutputs.r).toMatchObject({ error: "retriever provider unreachable" })
    expect(useSimulationStore.getState().isActive).toBe(true)
  })
})

describe("executeLiveNode — maxTokens resolution", () => {
  it("llm: resolves node.data.maxTokens into the returned output", async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [node("s", "start"), node("l", "llm", { maxTokens: 512 }), node("o", "output")],
      [edge("s", "l"), edge("l", "o")],
    )
    const s = await runToEnd()
    expect(s.nodeOutputs.l).toMatchObject({ maxTokens: 512 })
  })

  it("llm: falls back to MAX_TOKENS_DEFAULT (1024) when maxTokens is unset", async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [node("s", "start"), node("l", "llm"), node("o", "output")],
      [edge("s", "l"), edge("l", "o")],
    )
    const s = await runToEnd()
    expect(s.nodeOutputs.l).toMatchObject({ maxTokens: 1024 })
  })

  it("tool: resolves node.data.maxTokens, and falls back to MAX_TOKENS_DEFAULT when unset", async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [node("s", "start"), node("t", "tool", { maxTokens: 256 }), node("o", "output")],
      [edge("s", "t"), edge("t", "o")],
    )
    const withOverride = await runToEnd()
    expect(withOverride.nodeOutputs.t).toMatchObject({ maxTokens: 256 })

    loadGraph(
      [node("s", "start"), node("t2", "tool"), node("o", "output")],
      [edge("s", "t2"), edge("t2", "o")],
    )
    const withDefault = await runToEnd()
    expect(withDefault.nodeOutputs.t2).toMatchObject({ maxTokens: 1024 })
  })
})

describe('execution mode toggle', () => {
  it('toggles liveMode between simulation and live', () => {
    expect(useSimulationStore.getState().liveMode).toBe(false)
    useSimulationStore.getState().setLiveMode(true)
    expect(useSimulationStore.getState().liveMode).toBe(true)
    useSimulationStore.getState().setLiveMode(false)
    expect(useSimulationStore.getState().liveMode).toBe(false)
  })
})

describe('evalStore lastRunSummary recording', () => {
  beforeEach(() => {
    useEvalStore.setState({ lastRunSummary: null })
  })

  it('records a summary when a run completes', async () => {
    loadGraph(
      [node('s', 'start'), node('l', 'llm'), node('o', 'output')],
      [edge('s', 'l'), edge('l', 'o')],
    )
    await runToEnd()
    const summary = useEvalStore.getState().lastRunSummary
    expect(summary).not.toBeNull()
    // start + llm + output all executed, none skipped, no errors.
    expect(summary?.nodesExecuted).toBe(3)
    expect(summary?.errorCount).toBe(0)
    expect(summary?.runId).toBeTruthy()
    expect(typeof summary?.totalLatencyMs).toBe('number')
  })

  it('counts errored nodes and excludes skipped branches', async () => {
    // Diamond: the untaken branch is skipped, so it is not counted.
    loadGraph(
      [
        node('s', 'start'),
        node('c', 'condition', { branches: ['yes', 'no'] }),
        node('a', 'llm'),
        node('b', 'tool'),
        node('o', 'output'),
      ],
      [
        edge('s', 'c'),
        edge('c', 'a', 'yes'),
        edge('c', 'b', 'no'),
        edge('a', 'o'),
        edge('b', 'o'),
      ],
    )
    useSimulationStore.getState().setUserInput('yes please')
    await runToEnd()
    const summary = useEvalStore.getState().lastRunSummary
    // s, c, a, o executed; b skipped (not counted).
    expect(summary?.nodesExecuted).toBe(4)
    expect(summary?.errorCount).toBe(0)
  })
})

describe('executeLiveNode — memoryWriter and longTermStore', () => {
  beforeEach(() => {
    useMemoryStore.getState().clear()
  })

  it('memoryWriter: writes the current transcript content under writeNamespace', async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node('s', 'start'),
        node('m', 'memoryWriter', { writeNamespace: 'notes', memoryKind: 'semantic' }),
        node('o', 'output'),
      ],
      [edge('s', 'm'), edge('m', 'o')],
    )
    useSimulationStore.getState().setUserInput('remember this fact')
    const s = await runToEnd()

    expect(useMemoryStore.getState().read('notes')).toEqual(['remember this fact'])
    expect(s.nodeOutputs.m).toMatchObject({ namespace: 'notes', memoryKind: 'semantic' })
  })

  it('memoryWriter: falls back to the "default" namespace when writeNamespace is unset', async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [node('s', 'start'), node('m', 'memoryWriter'), node('o', 'output')],
      [edge('s', 'm'), edge('m', 'o')],
    )
    useSimulationStore.getState().setUserInput('hello')
    await runToEnd()

    expect(useMemoryStore.getState().read('default')).toEqual(['hello'])
  })

  it('longTermStore: storeOperation "write" persists the transcript under namespace', async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node('s', 'start'),
        node('t', 'longTermStore', { namespace: 'user_memories', storeOperation: 'write' }),
        node('o', 'output'),
      ],
      [edge('s', 't'), edge('t', 'o')],
    )
    useSimulationStore.getState().setUserInput('writes go here')
    const s = await runToEnd()

    expect(useMemoryStore.getState().read('user_memories')).toEqual(['writes go here'])
    expect(s.nodeOutputs.t).toMatchObject({ namespace: 'user_memories', operation: 'write' })
  })

  it('longTermStore: storeOperation "read" surfaces prior entries to the next live llm call', async () => {
    useMemoryStore.getState().write('user_memories', 'the user prefers dark mode')
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node('s', 'start'),
        node('t', 'longTermStore', { namespace: 'user_memories', storeOperation: 'read' }),
        node('l', 'llm'),
        node('o', 'output'),
      ],
      [edge('s', 't'), edge('t', 'l'), edge('l', 'o')],
    )
    const s = await runToEnd()

    expect(s.nodeOutputs.t).toMatchObject({
      namespace: 'user_memories',
      operation: 'read',
      results: ['the user prefers dark mode'],
    })
    const [, chat] = vi.mocked(streamChat).mock.calls.at(-1)!
    expect(chat.some((m) => m.content.includes('the user prefers dark mode'))).toBe(true)
  })

  it('longTermStore: storeOperation "search" filters entries by searchQuery', async () => {
    useMemoryStore.getState().write('kb', 'fact about cats')
    useMemoryStore.getState().write('kb', 'fact about dogs')
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node('s', 'start'),
        node('t', 'longTermStore', {
          namespace: 'kb',
          storeOperation: 'search',
          searchQuery: 'cats',
        }),
        node('o', 'output'),
      ],
      [edge('s', 't'), edge('t', 'o')],
    )
    const s = await runToEnd()

    expect(s.nodeOutputs.t).toMatchObject({ results: ['fact about cats'] })
  })
})

describe('humanInLoop — typed response reaches downstream LLM context', () => {
  it("threads the injected response into the next live 'llm' node's chat history", async () => {
    useSimulationStore.getState().setLiveMode(true)
    loadGraph(
      [
        node('s', 'start'),
        node('h', 'humanInLoop'),
        node('l', 'llm'),
        node('o', 'output'),
      ],
      [edge('s', 'h'), edge('h', 'l'), edge('l', 'o')],
    )
    await runUntilPending()
    useSimulationStore.getState().submitHumanInput('looks good, proceed')
    await vi.waitFor(() => {
      const st = useSimulationStore.getState()
      expect(st.currentNodeIndex).toBeGreaterThanOrEqual(st.executionQueue.length)
    })

    const lastCall = vi.mocked(streamChat).mock.calls.at(-1)
    expect(lastCall).toBeDefined()
    const [, chat] = lastCall!
    expect(chat).toContainEqual({ role: 'user', content: 'looks good, proceed' })
  })
})
