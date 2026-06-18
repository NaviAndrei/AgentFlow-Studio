# Node Output Caching + Run Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (T3-1) node-output caching so a re-run skips nodes whose resolved input is unchanged, and (T1-2) a side-by-side diff view for two selected runs in Run History.

**Architecture:** T3-1 hooks into `executeCurrent` in `simulationStore.ts`, the single per-node execution function of the dynamic walker. A hash of `{ node.data, sorted upstream outputs, userInput, liveMode }` is compared against a hash recorded on the previous run; on a hit the executor call is skipped and the previously-produced (real, non-truncated) output is replayed into a `'cached'` trace entry. T1-2 adds a pure `diffRuns()` comparator over two `RunRecord.traceSnapshot` arrays and a checkbox-driven compare UI in `RunHistoryPanel.tsx`.

**Tech Stack:** TypeScript strict, Zustand, Vitest, React 19.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Zustand selectors: primitives/stable references only — `diffRuns()` must run inside `useMemo`, never inside `useStore()`.
- No new npm dependencies.
- `npm run typecheck && npm run test` clean after each sub-task; full suite (typecheck + test + build) clean at the end.
- T3-1 fully done (incl. its own tests green) before any T1-2 code is written.

## Analysis-first findings (recap)

**T3-1:**
- There is **no existing single function** that resolves "a node's input" — each node type reads ad hoc from `get().messages` / `get().nodeOutputs` / `latestContent()` inside `executeLiveNode` (`simulationStore.ts:1107`) and the simulated-mode switch inside `executeCurrent` (`simulationStore.ts:2068-2140`). A new resolver is added in this plan (Task 1).
- The execution loop is `executeCurrent` (`simulationStore.ts:1837-2442`), called from `runLoop` (`:2444`) and `step()` (`:2575`). The cache check is inserted at the top of the `let output…` block, `simulationStore.ts:1996`.
- `TraceEntry.input`/`.output` are cosmetic/truncated (`makeEntry`, `:1916-1930`) — `input` is just `'from ' + prevLabel`, and `output` is `truncate(JSON.stringify(output), 120)`. Neither is safe to feed back into a downstream node, so the real (untruncated) output must be cached separately from the trace, in a module-level `nodeOutputCache: Map<string, unknown>` (mirrors the existing module-level bookkeeping pattern: `visitCounts`, `joinDeferCounts`, `guardedByMap`, etc. — `:220-267`).
- `runHistoryStore.ts` does not need to be read for the previous trace: the previous run's data we need (hash + real output) is kept directly in the simulation store/module state across `start()`/`restart()` calls, since `resetRunState` (`:2457`) — called by both — does **not** clear it. Only `stop()` (`:2519`, the "full reset" action) clears it, via the new `clearHashCache()` action.

**Scope decision (deviation from literal "every node" reading), to be flagged:** caching is skipped (node always executes fully) for `tryCatch`/`retry` (early-return bookkeeping nodes, never reach the cache check), `subgraph` (side effects on `messages`, produces `nestedTrace`), `map` (must re-run virtual-branch expansion every run — the virtual sidecar state is cleared every run), `humanInLoop` (must always pause for approval), and any virtual (Map-per-item) node. All other `SIMULATED_TYPES`, including `join`, are cache-eligible — `join`'s upstream virtual sources use deterministic ids (`` `${bodyId}__map_${i}` ``, `simulationStore.ts:1096`) so its resolved-input hash is stable across runs.

**T1-2:**
- `RunRecord` / `TraceEntry` confirmed in `src/types/index.ts` (shapes already known, see below).
- Run History UI is `src/components/RunHistoryPanel.tsx` (264 lines) — list view + detail view, no existing compare/diff action.
- `runHistoryStore.ts` (45 lines) has no compare-related state yet.

## File Structure

**T3-1**
- Create `src/utils/hashNodeInput.ts` — `hashNodeInput(input: unknown): string`.
- Create `src/utils/hashNodeInput.test.ts` — unit tests for the hash util itself (determinism, key-order independence).
- Modify `src/store/simulationStore.ts` — state (`nodeInputHashCache`), actions (`clearHashCache`, `setCachedHash`), module-level `nodeOutputCache`, cache-check + cache-write in `executeCurrent`, `clearHashCache()` call in `stop()`, `'cached'` accepted in the `recordRunHistory` output lookup (`:540`).
- Modify `src/types/index.ts` — `TraceEntry.status` union gains `'cached'`.
- Modify `src/nodes/NodeShell.tsx` — grey "⚡ cached" badge variant.
- Modify `src/components/TraceLog.tsx` — `'cached'` dot/style branch in `TraceEntryRow` for trace-log visual consistency.
- Modify `src/store/simulationStore.test.ts` — 3 new tests.

**T1-2**
- Create `src/utils/diffRuns.ts` — `diffRuns(runA, runB): NodeDiff[]`.
- Create `src/utils/diffRuns.test.ts` — 4 new tests.
- Modify `src/store/runHistoryStore.ts` — `compareRunIds`, `setCompareRunIds`.
- Modify `src/components/RunHistoryPanel.tsx` — checkboxes, Compare button, inline `DiffTable`.

---

### Task 1: `hashNodeInput` utility

**Files:** Create `src/utils/hashNodeInput.ts`, `src/utils/hashNodeInput.test.ts`.

**Interfaces:** Produces `hashNodeInput(input: unknown): string` — pure, synchronous, no crypto API. Consumed by `simulationStore.ts` in Task 2.

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/hashNodeInput.test.ts
import { describe, expect, it } from 'vitest'
import { hashNodeInput } from './hashNodeInput'

describe('hashNodeInput', () => {
  it('returns the same hash for structurally identical input regardless of key order', () => {
    const a = hashNodeInput({ foo: 1, bar: { z: 1, a: 2 } })
    const b = hashNodeInput({ bar: { a: 2, z: 1 }, foo: 1 })
    expect(a).toBe(b)
  })

  it('returns different hashes for different input', () => {
    const a = hashNodeInput({ foo: 1 })
    const b = hashNodeInput({ foo: 2 })
    expect(a).not.toBe(b)
  })

  it('is deterministic across repeated calls', () => {
    const input = { a: [1, 2, 3], b: 'x' }
    expect(hashNodeInput(input)).toBe(hashNodeInput(input))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- hashNodeInput`
Expected: FAIL — `Cannot find module './hashNodeInput'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/hashNodeInput.ts
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    )
    const sorted: Record<string, unknown> = {}
    for (const [key, val] of entries) sorted[key] = sortKeysDeep(val)
    return sorted
  }
  return value
}

function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

/** Pure, synchronous structural hash — no crypto API, stable key order. */
export function hashNodeInput(input: unknown): string {
  return djb2(JSON.stringify(sortKeysDeep(input)))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- hashNodeInput`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add src/utils/hashNodeInput.ts src/utils/hashNodeInput.test.ts
git commit -m "feat: add pure hashNodeInput utility for cache-key hashing"
```

---

### Task 2: `TraceEntry.status` gains `'cached'`

**Files:** Modify `src/types/index.ts`, `src/nodes/NodeShell.tsx`, `src/components/TraceLog.tsx`.

**Interfaces:** Produces the `'cached'` member of `TraceEntry['status']`, consumed by Task 3 (store) and the badge/trace-log rendering below.

- [ ] **Step 1: Widen the union**

In `src/types/index.ts`, change:

```typescript
status: 'ok' | 'error' | 'skipped'
```

to:

```typescript
status: 'ok' | 'error' | 'skipped' | 'cached'
```

- [ ] **Step 2: Extend the NodeShell badge**

In `src/nodes/NodeShell.tsx`, replace the badge block (current lines ~136-147):

```tsx
{outputBadge && (simStatus === 'completed' || simStatus === 'error') && (
  <div
    title={`INPUT:\n${outputBadge.input}\n\nOUTPUT:\n${outputBadge.output}`}
    className={`nodrag mt-1 w-52 cursor-default truncate rounded border px-2 py-0.5 text-[10px] ${
      outputBadge.status === 'ok'
        ? 'border-green-500/60 bg-green-500/10 text-green-300'
        : 'border-red-500/60 bg-red-500/10 text-red-300'
    }`}
  >
    {outputBadge.output}
  </div>
)}
```

with:

```tsx
{outputBadge && (simStatus === 'completed' || simStatus === 'error') && (
  <div
    title={`INPUT:\n${outputBadge.input}\n\nOUTPUT:\n${outputBadge.output}`}
    className={`nodrag mt-1 w-52 cursor-default truncate rounded border px-2 py-0.5 text-[10px] ${
      outputBadge.status === 'cached'
        ? 'border-gray-500/60 bg-gray-500/10 text-gray-300'
        : outputBadge.status === 'ok'
          ? 'border-green-500/60 bg-green-500/10 text-green-300'
          : 'border-red-500/60 bg-red-500/10 text-red-300'
    }`}
  >
    {outputBadge.status === 'cached' ? `⚡ cached: ${outputBadge.output}` : outputBadge.output}
  </div>
)}
```

- [ ] **Step 3: Extend the TraceLog dot/style branch**

In `src/components/TraceLog.tsx`, in `TraceEntryRow`, replace:

```tsx
<span
  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
    entry.status === 'error'
      ? 'bg-red-500'
      : entry.status === 'skipped'
        ? 'bg-gray-600'
        : 'bg-green-500'
  }`}
/>
```

with:

```tsx
<span
  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
    entry.status === 'error'
      ? 'bg-red-500'
      : entry.status === 'skipped'
        ? 'bg-gray-600'
        : entry.status === 'cached'
          ? 'bg-gray-400'
          : 'bg-green-500'
  }`}
/>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean (no exhaustiveness errors — both switches above are ternaries, not `switch`, so the new union member doesn't break compilation; this step just confirms no other file pattern-matches the union exhaustively).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/nodes/NodeShell.tsx src/components/TraceLog.tsx
git commit -m "feat: add 'cached' TraceEntry status with badge and trace-log styling"
```

---

### Task 3: Cache state + actions in `simulationStore.ts`

**Files:** Modify `src/store/simulationStore.ts`.

**Interfaces:** Consumes `hashNodeInput` (Task 1). Produces `nodeInputHashCache: Map<string, string>`, `clearHashCache(): void`, `setCachedHash(nodeId: string, hash: string): void`, plus an internal `nodeOutputCache` module map used by Task 4.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/store/simulationStore.test.ts
describe('node output caching — state plumbing', () => {
  it('clearHashCache resets all cached entries', () => {
    useSimulationStore.getState().setCachedHash('n1', 'abc123')
    expect(useSimulationStore.getState().nodeInputHashCache.get('n1')).toBe('abc123')
    useSimulationStore.getState().clearHashCache()
    expect(useSimulationStore.getState().nodeInputHashCache.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- simulationStore -t "clearHashCache resets"`
Expected: FAIL — `setCachedHash is not a function`

- [ ] **Step 3: Implement minimal state/actions**

Add the module-level output cache near the other module-level maps (`src/store/simulationStore.ts`, right after the `clearFlowControlState` block, ~line 249):

```typescript
// Node output caching: the real (untruncated) output of the last successful
// run for each cache-eligible node, keyed by node id. Paired with
// nodeInputHashCache (Zustand state) — a hit requires both the hash to match
// AND an entry to exist here (entries are only written after a real 'ok'
// completion, so "exists" already implies "last run succeeded").
let nodeOutputCache = new Map<string, unknown>()
```

Add to `SimulationState` interface (after `retryStatus`, ~line 201):

```typescript
  /** Hash of each cache-eligible node's resolved input from its last run. */
  nodeInputHashCache: Map<string, string>
  /** Clears the input-hash and output cache (called on stop() / full reset). */
  clearHashCache: () => void
  /** Records the resolved-input hash for a node after it runs. */
  setCachedHash: (nodeId: string, hash: string) => void
```

Add to the initial state object (after `retryStatus: {},` in the returned object, ~line 2503):

```typescript
    nodeInputHashCache: new Map<string, string>(),
```

Add the actions (after `clearTrace`, ~line 2508):

```typescript
    clearHashCache: () => {
      nodeOutputCache = new Map()
      set({ nodeInputHashCache: new Map() })
    },
    setCachedHash: (nodeId, hash) =>
      set({
        nodeInputHashCache: new Map(get().nodeInputHashCache).set(nodeId, hash),
      }),
```

Call it from `stop()` (full reset) — add as the first line inside `stop()`'s body, right after `runToken++` (~line 2520):

```typescript
    stop: () => {
      runToken++
      get().clearHashCache()
      abortInFlight()
      ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- simulationStore -t "clearHashCache resets"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/simulationStore.ts src/store/simulationStore.test.ts
git commit -m "feat: add nodeInputHashCache state and clearHashCache/setCachedHash actions"
```

---

### Task 4: Wire the cache check into `executeCurrent`

**Files:** Modify `src/store/simulationStore.ts` (the `executeCurrent` function, `:1837-2442`).

**Interfaces:** Consumes `hashNodeInput` (Task 1), `nodeInputHashCache`/`setCachedHash`/`nodeOutputCache` (Task 3), `flowSources` (existing, `:681`). Produces the `'cached'` trace-entry path consumed by Tasks 2's NodeShell/TraceLog rendering and by the tests in this task.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to src/store/simulationStore.test.ts
describe('node output caching — execution skip', () => {
  const linear = () => {
    loadGraph(
      [
        node('s', 'start'),
        node('t', 'tool', { toolName: 'search' }),
        node('o', 'output'),
      ],
      [edge('s', 't'), edge('t', 'o')],
    )
  }

  it('caches node output on identical re-run', async () => {
    linear()
    await runToEnd()
    useSimulationStore.getState().start()
    const s2 = await runToEnd()
    const cachedEntries = s2.trace.filter((t) => t.status === 'cached')
    // start/tool/output are all cache-eligible and unchanged.
    expect(cachedEntries.map((e) => e.nodeId).sort()).toEqual(['o', 's', 't'])
    expect(s2.nodeOutputs.t).toEqual(
      (await useSimulationStore.getState()).nodeOutputs.t,
    )
  })

  it('re-executes node when upstream output changes', async () => {
    linear()
    await runToEnd()
    // Change the tool node's config — its own hash changes, so it
    // re-executes; the unchanged Output node downstream then also
    // re-executes because ITS upstream output (tool's) changed.
    useCanvasStore.setState({
      nodes: useCanvasStore
        .getState()
        .nodes.map((n) => (n.id === 't' ? { ...n, data: { ...n.data, toolName: 'fetch' } } : n)),
    })
    useSimulationStore.getState().start()
    const s2 = await runToEnd()
    const okEntries = s2.trace.filter((t) => t.status === 'ok').map((e) => e.nodeId)
    const cachedIds = s2.trace.filter((t) => t.status === 'cached').map((e) => e.nodeId)
    expect(okEntries).toContain('t')
    expect(okEntries).toContain('o')
    expect(cachedIds).toEqual(['s'])
  })

  it('clearHashCache forces full re-execution on the next run', async () => {
    linear()
    await runToEnd()
    useSimulationStore.getState().clearHashCache()
    useSimulationStore.getState().start()
    const s2 = await runToEnd()
    expect(s2.trace.some((t) => t.status === 'cached')).toBe(false)
    expect(s2.trace.filter((t) => t.status === 'ok')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- simulationStore -t "node output caching — execution skip"`
Expected: FAIL — all three see 0 `'cached'` entries (caching not wired up yet).

- [ ] **Step 3: Implement the cache check**

Add a resolver helper inside the store's `create()` closure, near `flowSources` (after its definition, ~line 689):

```typescript
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

  /** Node types that never participate in output caching — see plan notes. */
  const CACHE_INELIGIBLE_TYPES: AgentFlowNodeType[] = [
    'subgraph',
    'map',
    'humanInLoop',
  ]
```

Replace the start of the normal-path block (`src/store/simulationStore.ts:1996-1999`):

```typescript
      let output: unknown
      // Trace entries from a Subgraph node's inner sub-walker, appended to
      // the parent trace alongside this node's own entry.
      let nestedTrace: TraceEntry[] = []
      try {
```

with:

```typescript
      let output: unknown
      // Trace entries from a Subgraph node's inner sub-walker, appended to
      // the parent trace alongside this node's own entry.
      let nestedTrace: TraceEntry[] = []

      const cacheEligible =
        node.type !== undefined &&
        !CACHE_INELIGIBLE_TYPES.includes(node.type) &&
        !virtualMeta.has(nodeId)
      const inputHash = cacheEligible ? hashNodeInput(resolveCacheInput(nodeId, node)) : null
      const cacheHit =
        inputHash !== null &&
        get().nodeInputHashCache.get(nodeId) === inputHash &&
        nodeOutputCache.has(nodeId)

      if (cacheHit) {
        output = nodeOutputCache.get(nodeId)
      } else {
      try {
```

And close the new `else` right before the existing `} catch (error) {` (`:2141`) stays — i.e. the existing `try { … }` block's closing brace now closes the `else`, so wrap with one more `}`. Concretely, change `:2141` from:

```typescript
      } catch (error) {
```

to:

```typescript
      } catch (error) {
```

(unchanged — it's still the `catch` for the `try`), but add a closing `}` for the new `else` immediately after the whole `try/catch` statement ends, i.e. right after the existing line `:2237` (`      }`, the closing brace of the `catch` block) insert:

```typescript
      }
```

So the structure becomes:
```typescript
if (cacheHit) {
  output = nodeOutputCache.get(nodeId)
} else {
  try {
    ...unchanged...
  } catch (error) {
    ...unchanged...
  }
}
```

Then, after the existing line `:2240` (`if (token !== runToken) return`) and before the `loop` override (`:2243`), record the cache write for a freshly-executed (non-hit) node:

```typescript
      // Stopped or restarted while this node was executing — discard.
      if (token !== runToken) return

      if (cacheEligible && inputHash !== null && !cacheHit) {
        nodeOutputCache.set(nodeId, output)
        get().setCachedHash(nodeId, inputHash)
      }
```

Finally, change the trace-entry construction so a cache hit produces a `'cached'` status with `durationMs: 0` instead of `'ok'`. Replace (`:2407-2414`):

```typescript
      const errored = get().erroredNodeIds
      // Stamp parentNodeId on a virtual node's trace entry (Map per-item
      // branch) so the trace can be grouped by its originating Map node.
      const baseEntry = makeEntry('ok', output)
      const parentMapId = virtualParents.get(nodeId)
      const taggedEntry: TraceEntry = parentMapId
        ? { ...baseEntry, parentNodeId: parentMapId }
        : baseEntry
```

with:

```typescript
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
```

Add the import at the top of the file (with the other `../utils/*` imports, ~line 9):

```typescript
import { hashNodeInput } from '../utils/hashNodeInput'
```

Finally, widen the `recordRunHistory` output lookup (`:540`) so a cached Output node still counts for eval scoring:

```typescript
        .find((e) => e.nodeType === 'output' && (e.status === 'ok' || e.status === 'cached'))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- simulationStore`
Expected: PASS, full file (184 + 4 new = 188... — wait, T3-1 adds 1 (Task 3) + 3 (Task 4) = 4 new tests here, T1-2 adds 4 more later for 188 total; see Final Verification).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm run typecheck && npm run test`
Expected: both clean, all existing + new tests green.

- [ ] **Step 6: Commit**

```bash
git add src/store/simulationStore.ts src/store/simulationStore.test.ts
git commit -m "feat: skip re-execution for nodes whose resolved input is unchanged"
```

---

### Task 5: `diffRuns` utility

**Files:** Create `src/utils/diffRuns.ts`, `src/utils/diffRuns.test.ts`.

**Interfaces:** Consumes `RunRecord`/`TraceEntry` from `src/types/index.ts` (existing). Produces `NodeDiff` and `diffRuns(runA: RunRecord, runB: RunRecord): NodeDiff[]`, consumed by Task 7 (`RunHistoryPanel.tsx`).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/utils/diffRuns.test.ts
import { describe, expect, it } from 'vitest'
import { diffRuns } from './diffRuns'
import type { RunRecord, TraceEntry } from '../types'

function entry(overrides: Partial<TraceEntry>): TraceEntry {
  return {
    id: overrides.id ?? 'e1',
    at: 0,
    nodeId: 'n1',
    nodeName: 'Node 1',
    nodeType: 'llm',
    status: 'ok',
    durationMs: 100,
    input: '—',
    output: 'hello',
    ...overrides,
  }
}

function run(overrides: Partial<RunRecord>): RunRecord {
  return {
    id: 'r1',
    startedAt: 0,
    finishedAt: 100,
    durationMs: 100,
    mode: 'simulated',
    status: 'done',
    nodeCount: 1,
    stepCount: 1,
    totalTokens: 0,
    totalCostUsd: 0,
    model: 'gpt-4',
    qualityScore: null,
    evalPassCount: null,
    evalTotalCount: null,
    traceSnapshot: [],
    costSnapshot: null,
    ...overrides,
  }
}

describe('diffRuns', () => {
  it('returns empty array for identical runs', () => {
    const trace = [entry({})]
    const a = run({ traceSnapshot: trace })
    const b = run({ traceSnapshot: trace })
    expect(diffRuns(a, b)).toEqual([])
  })

  it('detects status change from ok to error', () => {
    const a = run({ traceSnapshot: [entry({ status: 'ok' })] })
    const b = run({ traceSnapshot: [entry({ status: 'error', output: 'boom' })] })
    const diff = diffRuns(a, b)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toMatchObject({ nodeId: 'n1', statusA: 'ok', statusB: 'error' })
  })

  it('detects output change between runs', () => {
    const a = run({ traceSnapshot: [entry({ output: 'hello' })] })
    const b = run({ traceSnapshot: [entry({ output: 'goodbye' })] })
    const diff = diffRuns(a, b)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toMatchObject({ outputA: 'hello', outputB: 'goodbye' })
  })

  it('calculates correct duration delta', () => {
    const a = run({ traceSnapshot: [entry({ durationMs: 100 })] })
    const b = run({ traceSnapshot: [entry({ durationMs: 250 })] })
    const diff = diffRuns(a, b)
    expect(diff).toHaveLength(1)
    expect(diff[0].durationDeltaMs).toBe(150)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- diffRuns`
Expected: FAIL — `Cannot find module './diffRuns'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/diffRuns.ts
import type { RunRecord, TraceEntry } from '../types'

export interface NodeDiff {
  nodeId: string
  nodeLabel: string
  statusA: TraceEntry['status'] | null
  statusB: TraceEntry['status'] | null
  outputA: string | null
  outputB: string | null
  durationDeltaMs: number
}

function lastByNode(trace: TraceEntry[]): Map<string, TraceEntry> {
  const map = new Map<string, TraceEntry>()
  for (const entry of trace) map.set(entry.nodeId, entry)
  return map
}

/** Pure comparison of two runs' final per-node trace entries. No side effects. */
export function diffRuns(runA: RunRecord, runB: RunRecord): NodeDiff[] {
  const a = lastByNode(runA.traceSnapshot)
  const b = lastByNode(runB.traceSnapshot)
  const nodeIds = new Set([...a.keys(), ...b.keys()])
  const diffs: NodeDiff[] = []
  for (const nodeId of nodeIds) {
    const ea = a.get(nodeId) ?? null
    const eb = b.get(nodeId) ?? null
    const statusA = ea?.status ?? null
    const statusB = eb?.status ?? null
    const outputA = ea?.output ?? null
    const outputB = eb?.output ?? null
    const durationDeltaMs = (eb?.durationMs ?? 0) - (ea?.durationMs ?? 0)
    if (statusA === statusB && outputA === outputB && durationDeltaMs === 0) continue
    diffs.push({
      nodeId,
      nodeLabel: eb?.nodeName ?? ea?.nodeName ?? nodeId,
      statusA,
      statusB,
      outputA,
      outputB,
      durationDeltaMs,
    })
  }
  return diffs
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- diffRuns`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add src/utils/diffRuns.ts src/utils/diffRuns.test.ts
git commit -m "feat: add pure diffRuns comparator for two run trace snapshots"
```

---

### Task 6: `runHistoryStore` compare-selection state

**Files:** Modify `src/store/runHistoryStore.ts`.

**Interfaces:** Produces `compareRunIds: [string, string] | null`, `setCompareRunIds: (ids: [string, string] | null) => void`, consumed by Task 7.

- [ ] **Step 1: Add state + action**

In `src/store/runHistoryStore.ts`, add to the interface:

```typescript
  compareRunIds: [string, string] | null
  setCompareRunIds: (ids: [string, string] | null) => void
```

Add to the initial state object: `compareRunIds: null,`

Add the action next to `setSelectedRunId`:

```typescript
  setCompareRunIds: (compareRunIds) => set({ compareRunIds }),
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/store/runHistoryStore.ts
git commit -m "feat: add compareRunIds selection state to runHistoryStore"
```

---

### Task 7: Compare UI in `RunHistoryPanel.tsx`

**Files:** Modify `src/components/RunHistoryPanel.tsx`.

**Interfaces:** Consumes `diffRuns` (Task 5), `compareRunIds`/`setCompareRunIds` (Task 6). No new exports.

- [ ] **Step 1: Add checkbox state, a Compare button, and the DiffTable**

In the list view, where each run card is rendered, add a checkbox bound to `compareRunIds` (toggle into/out of the pair, capping at 2), and an inline `DiffTable` component (rendered when `compareRunIds` is a full pair) that calls `diffRuns` inside a `useMemo` keyed on the two run ids — never inside a `useRunHistoryStore` selector. Example shape for the new pieces (added alongside the existing list-view JSX, using the existing `runs` array already in scope):

```tsx
const compareRunIds = useRunHistoryStore((s) => s.compareRunIds)
const setCompareRunIds = useRunHistoryStore((s) => s.setCompareRunIds)
const runs = useRunHistoryStore((s) => s.runs)

const toggleCompare = (id: string) => {
  if (!compareRunIds) {
    setCompareRunIds([id, id] as [string, string])
    return
  }
  const [first, second] = compareRunIds
  if (id === first || id === second) {
    setCompareRunIds(null)
    return
  }
  setCompareRunIds([first, id])
}

const diff = useMemo(() => {
  if (!compareRunIds) return null
  const [idA, idB] = compareRunIds
  if (idA === idB) return null
  const runA = runs.find((r) => r.id === idA)
  const runB = runs.find((r) => r.id === idB)
  if (!runA || !runB) return null
  return diffRuns(runA, runB)
}, [compareRunIds, runs])
```

```tsx
function DiffTable({ diff }: { diff: NodeDiff[] }) {
  return (
    <div className="overflow-y-auto rounded border border-white/10">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-surface-2 text-gray-400">
          <tr>
            <th className="px-2 py-1 text-left">Node</th>
            <th className="px-2 py-1 text-left">Status A→B</th>
            <th className="px-2 py-1 text-left">Output A</th>
            <th className="px-2 py-1 text-left">Output B</th>
            <th className="px-2 py-1 text-right">Δ Duration</th>
          </tr>
        </thead>
        <tbody>
          {diff.map((d) => {
            const improved = d.statusA === 'error' && d.statusB === 'ok'
            const degraded = d.statusA === 'ok' && d.statusB === 'error'
            return (
              <tr
                key={d.nodeId}
                className={
                  improved
                    ? 'bg-green-500/10 text-green-300'
                    : degraded
                      ? 'bg-red-500/10 text-red-300'
                      : 'text-gray-400'
                }
              >
                <td className="truncate px-2 py-1">{d.nodeLabel}</td>
                <td className="px-2 py-1">{d.statusA ?? '—'} → {d.statusB ?? '—'}</td>
                <td className="max-w-[160px] truncate px-2 py-1">{(d.outputA ?? '—').slice(0, 120)}</td>
                <td className="max-w-[160px] truncate px-2 py-1">{(d.outputB ?? '—').slice(0, 120)}</td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {d.durationDeltaMs > 0 ? '+' : ''}{d.durationDeltaMs}ms
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

Wire a checkbox per run card (in the existing list-rendering `.map`):

```tsx
<input
  type="checkbox"
  className="nodrag"
  checked={!!compareRunIds && (compareRunIds[0] === run.id || compareRunIds[1] === run.id)}
  onClick={(e) => e.stopPropagation()}
  onChange={(e) => {
    e.stopPropagation()
    toggleCompare(run.id)
  }}
/>
```

And render the diff table when both slots are filled and distinct:

```tsx
{diff && (
  <div className="border-t border-white/10 p-2">
    <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
      <span>Comparing 2 runs</span>
      <button onClick={() => setCompareRunIds(null)} className="text-gray-500 hover:text-gray-300">
        Clear
      </button>
    </div>
    <DiffTable diff={diff} />
  </div>
)}
```

Add imports at the top of `RunHistoryPanel.tsx`:

```typescript
import { useMemo } from 'react'
import { diffRuns, type NodeDiff } from '../utils/diffRuns'
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open Run History, run the simulation twice, check two run checkboxes, confirm the diff table renders with sensible rows, uncheck/Clear removes it.

- [ ] **Step 4: Commit**

```bash
git add src/components/RunHistoryPanel.tsx
git commit -m "feat: add run comparison checkboxes and diff table to Run History"
```

---

## Final Verification

- [ ] `npm run typecheck` — clean
- [ ] `npm run test` — 188/188 (184 existing + 1 clearHashCache test + 3 cache-skip tests + 4 diffRuns tests = 192; if the existing baseline differs, the only requirement is "no regressions, all new tests included")
- [ ] `npm run build` — succeeds, no warnings
- [ ] `grep -rn "useSimulationStore((s) => ({" src/` and the `useRunHistoryStore` equivalent — confirm no inline object/array construction inside a selector (the new `diff` `useMemo` in Task 7 is the one place that builds a derived array, and it is explicitly outside any selector)
- [ ] Update `docs/progress.md` — what was done, current test count, next steps (Time-travel debugger, T2-2)
