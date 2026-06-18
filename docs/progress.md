# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`

---

## Handoff — 2026-06-19

### What was completed
- **Time-Travel Debugger (T2-2) ✅**
  - `StepSnapshot` type + `RunRecord.snapshots` (`src/types/index.ts`)
  - `simulationStore.ts`: `snapshots` state, `makeSnapshot()` helper capturing untruncated
    input (`resolveCacheInput`) + output at every primary trace-entry site (ok/cached/error/
    retry/tryCatch/map); cleared in `resetRunState`/`stop`; archived via `structuredClone` in `recordRunHistory`
  - New `debuggerStore.ts` — ephemeral playback state (`dockTab`, `activeStepIndex`, `isPlaying`,
    `playbackSpeed`, `activeStepNodeId`, `showDiff`)
  - New `components/debugger/TimeTravelBar.tsx` (scrubber/controls/speed; Fork stub disabled) +
    `SnapshotInspector.tsx` (input/output state, diff highlight; reuses `JsonValue`)
  - `TraceLog.tsx` gained **Trace Log | Time Travel** tabs; `RunHistoryPanel.tsx` selecting a run
    opens the Time Travel tab; `NodeShell.tsx` + `.tt-active` CSS give the active step an amber ring
  - Highlight uses a store selector (NOT `updateNodeData`) to avoid dirtying the canvas/undo
  - **Deferred**: "Fork from here" (re-seeding the engine mid-state) — button is a disabled stub
- **Node search in palette (Task B) ✅** — `Sidebar.tsx`: debounced (150ms) search, hides empty
  groups, ↑/↓ highlight, Enter adds first match at canvas center (`addNode`), Esc clears

### Current state
- typecheck: clean ✅ · build: clean ✅ (pre-existing fflate/chunk warnings only)
- tests: **203/203 passing** ✅ (192 prior + 11 new: snapshots ×3 wait, debuggerStore ×5, TimeTravelBar ×3)
- Browser-verified: build Sequential Pipeline → run → select run → step through snapshots; active
  node ring, step counter, scrubber, untruncated input/output state all work; Task B filter/Enter/Esc work
- Note: no jsdom/testing-library in repo (node env + window stub), so the TimeTravelBar test is the
  project's non-rendering smoke+store-integration style, not a DOM render test

### Next steps
1. [ ] "Fork from here" — re-seed `simulationStore` (nodeOutputs/visitCounts) from a snapshot and run onward
2. [ ] Follow-ons A (streaming LLM output) and C (canvas undo/redo) from the T2-2 session brief

---

## Handoff — 2026-06-18

### What was completed
- **Node output caching + partial re-execution (T3-1) ✅**
  - `src/utils/hashNodeInput.ts` — pure djb2 hash over deep-sorted-key `JSON.stringify`, no crypto API
  - `simulationStore.ts`: `nodeInputHashCache` (Zustand state) + module-level `nodeOutputCache` (real, untruncated output) + `clearHashCache()`/`setCachedHash()` actions
  - Cache check wired into `executeCurrent`: hashes `{ node.data, sorted upstream outputs, userInput, liveMode }`, skips the executor on a hit, replays the cached output into a `'cached'`-status trace entry (`durationMs: 0`)
  - Cache eligibility: excludes `subgraph`/`map`/`humanInLoop`, virtual (Map-per-item) nodes, and — critically — any node beyond its **first visit in a run** (loop/cycle revisits always fully re-execute, so `MAX_NODE_VISITS` semantics stay intact)
  - Cache persists across `start()`/`restart()` (re-runs), cleared only by `stop()` via `clearHashCache()`
  - `TraceEntry.status` gained `'cached'`; grey "⚡ cached" badge in `NodeShell.tsx`, grey dot in `TraceLog.tsx`; eval-scoring lookup in `finishRun()` now accepts cached Output nodes
  - 4 new tests in `simulationStore.test.ts` (state plumbing + 3 execution-skip scenarios)

- **Run diff UI in Run History (T1-2) ✅**
  - `src/utils/diffRuns.ts` — pure `diffRuns(runA, runB): NodeDiff[]`, compares last-per-node trace entries (status/output/duration delta)
  - `runHistoryStore.ts`: `compareRunIds: [string, string] | null` + `setCompareRunIds`
  - `RunHistoryPanel.tsx`: per-run checkbox (caps at a pair), inline `DiffTable` (sub-80-line component), row coloring (green = error→ok improvement, red = ok→error degradation, grey = unchanged); `diffRuns()` called inside `useMemo`, never inside a store selector

### Current state
- typecheck: clean ✅
- build: clean ✅ (pre-existing fflate dynamic/static import warning + >500kB chunk warning, unrelated to this work)
- tests: **192/192 passing** ✅ (188 prior + 4 new `diffRuns` tests; T3-1's 4 tests already included in the 188)
- grep confirms no inline-object Zustand selectors introduced

### Next steps (from feature analysis)
1. [ ] Time-travel debugger (T2-2) — snapshot per step for backward inspection

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
Components work → also `@COMPONENTS.md`
Stores/simulation → also `@ARCHITECTURE.md`
Something seems wrong → check `@DECISIONS.md` first
