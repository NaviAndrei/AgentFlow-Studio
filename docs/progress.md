# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`

---

## Handoff — 2026-06-19 (Fork from Here + Undo/Redo polish)

### What was completed
- **Important discovery before any code was written**: the session brief asked for
  three workstreams (Fork from Here, streaming LLM output, canvas undo/redo).
  Codebase exploration found that **streaming LLM output and the undo/redo engine
  already existed** from prior sessions — `simulationStore.nodeStreams[id]` +
  `<StreamingText>` (typewriter + blinking caret, reduced-motion handled) covers
  streaming in both live and simulated mode already; `canvasStore.history`/`future`
  + `pushHistory()` + Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y were already fully wired. Confirmed
  scope with the user before implementing — streaming was skipped entirely, undo/redo
  was reduced to closing the real gaps only. **If a future brief asks for either of
  these again, check the existing code first** — `nodeStreams`/`StreamingText` in
  `NodeShell.tsx` and `history`/`future` in `canvasStore.ts`.
- **Toast notification system (new) ✅** — `src/store/toastStore.ts` (ephemeral
  `toasts: ToastMessage[]`, `pushToast`/`dismissToast`, 3s auto-dismiss) +
  `src/components/ToastHost.tsx` (fixed top-right stack, `z-[60]`, click to dismiss),
  mounted in `App.tsx`. First feedback mechanism in the app beyond `window.alert()`.
- **Fork from Here (T2-2 follow-on) ✅** — the disabled stub button in
  `TimeTravelBar.tsx` now works. `StepSnapshot` gained `messagesState?: ChatMessage[]`
  (captured via `structuredClone(get().messages)` in `makeSnapshot()`) so a fork can
  restore the exact chat transcript at the fork point. New `simulationStore.
  forkFromSnapshot(snapshots, stepIndex)` action: reuses `resetRunState([targetNodeId])`
  (same shape as `start()`), pre-seeds `nodeOutputs`/`visitCounts`/`executedIds`/
  `erroredNodeIds`/`skippedNodeIds` from the snapshots before the fork point, then
  calls `play()`. **No `forkFromNodeId` execution guard was added** — the engine is a
  dynamic forward walker (`executionQueue` grows via `enqueueTargets` as nodes
  execute), so seeding `visitCounts` alone reproduces correct `MAX_NODE_VISITS`
  semantics without needing a separate skip-guard. Browser-verified: forking from a
  mid-run step on the Sequential Pipeline blueprint correctly re-executed only the
  fork node onward while pre-fork nodes stayed marked completed on canvas.
- **Undo/redo gap-closing ✅** — `canvasStore.Snapshot` gained a `label: string`
  field, stamped at all 15 `pushHistory()` call sites (`Add llm node`, `Delete node`,
  `Connect A → B`, etc.). `undo()`/`redo()` now return `string | null` (the label, or
  null if there was nothing to undo/redo) instead of `void`. `useKeyboardShortcuts.ts`
  now pushes a toast (`Undone: <label>` / `Redone: <label>`) and skips Ctrl+Z/Shift+Z/Y
  entirely while `simulationStore.isRunning` is true. `loadGraph()` now hard-clears
  `history`/`future` instead of pushing one snapshot before loading. Browser-verified:
  add/undo/redo a node — toast text and canvas state both correct.

### Current state
- typecheck: clean ✅ · build: clean ✅ (pre-existing fflate/chunk warnings only)
- tests: **203/203 passing** ✅ (no new tests added — this was scoped as gap-closing
  on top of an already-tested engine; consider adding `forkFromSnapshot` and the
  `Snapshot.label` plumbing to the test suite next session if more confidence is
  wanted before touching this code again)
- Browser-verified live via preview tools: blueprint load → run → Time Travel → Fork
  from a mid-step (Sequential Pipeline, 6-node chain) → new run resumes correctly;
  separately, add node → Ctrl+Z → toast "Undone: Add output node" → Ctrl+Shift+Z →
  toast "Redone: ..." → node restored.

### Next steps
1. [ ] Consider adding unit tests for `forkFromSnapshot` (step-0 degenerate case,
   mid-run re-seed, visit-count carry-over for loop nodes) and for the `Snapshot.label`
   plumbing in `canvasStore` — neither has direct test coverage yet.
2. [ ] Toast stacking on rapid-fire undo (holding Ctrl+Z) wasn't checked under load —
   if it turns out visually noisy, coalesce repeats by id instead of queuing each one.
3. [ ] Original T2-2 follow-ons (Follow-on A: streaming — confirmed already done,
   Follow-on C: canvas undo/redo — confirmed already done) are now both closed out.

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
