import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { AgentFlowNode, AgentFlowNodeData, AgentFlowNodeType } from '../types'
import { useCanvasStore } from './canvasStore'
import { useSimulationStore } from './simulationStore'
import { useSimulationMetricsStore } from './simulationMetricsStore'

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

  it('skips the downstream and ends the run on reject', async () => {
    gated()
    await runUntilPending()
    useSimulationStore.getState().reject()
    const s = useSimulationStore.getState()
    expect(s.pendingApproval).toBeNull()
    expect(s.skippedNodeIds.has('o')).toBe(true)
    expect(s.executedIds.has('o')).toBe(false)
    expect(s.nodeOutputs.h).toMatchObject({ approved: false })
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
