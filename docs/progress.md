# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`

---

## Active Architecture Decisions
> Decisions made — preserves WHY across sessions

- **Cycles are warnings, not errors**: `MAX_NODE_VISITS = 2` is the runtime guard; `detectCycle` only toasts a warning for unguarded cycles (no router/condition/guardrail). See Session 10 Task B.
- **localStorage exception for snapshots**: `snapshotStore` uses `localStorage` (scoped exception to the "no localStorage" rule) — manual save slots require it. See Session 9 Task A.
- **`html-to-image` with `skipFonts: true`**: Cross-origin Google Fonts stylesheet causes SecurityError — exported PNGs use system monospace. See Session 8 Task A.
- **PowerShell-only CI**: `scripts/pre-push-check.ps1` — no bash. See Session 10 Prompt 10.

## Next Session Entrypoint
> Paste this into the agent at the start of the next session:

```
@CLAUDE.md @docs/progress.md
Continue from Session 10. Key context: 264/264 tests passing, DRY debt resolved, pre-push CI script wired. Next priority: wire real LLM calls into non-LLM node types (see Pre-flight Audit in Session 10).
```

## Open TODOs
- [ ] Wire `pre-push-check.ps1` as a Git pre-push hook — agent — HIGH
- [ ] Wire real LLM calls into `default:` branch of `executeLiveNode` (agent/supervisor/loop) — agent — HIGH
- [ ] Add `maxTokens?: number` to `AgentFlowNodeData` — agent — MED
- [ ] Remove inline Approve/Reject buttons from `MetricsBar.tsx` (duplicated by modal) — agent — LOW
- [ ] Consider `-StepOnly` param for `pre-push-check.ps1` — human — LOW

## Known Gaps (intentionally deferred)
- **Viewport screenshot in headless**: stalls on html-to-image resource loading in the preview env — works in real browser. Not a regression.
- **TraceLog virtualization untested at scale**: engine clears trace per run, so 50+ entries never reached naturally. Re-verify if a merge-trace feature is added.
- **`G` shortcut escape hatch**: fires globally without `isEditableTarget` check — low risk today, re-evaluate if custom focusable editors are added.

---

## Handoff — 2026-06-23 (Session 10 — Prompts 9 & 10: DRY cleanup + pre-push CI)

### Prompt 9 — DRY Debt Resolution & Test Isolation Fix ✅

**Step 1 — `vitest.config.ts` global mock isolation**
- Added `clearMocks: true` and `restoreMocks: true` inside the `test: {}` block.
- Root cause: `vi.spyOn` on an already-mocked method returns the same spy instance — without
  global clear/restore, call counts leak across tests in the same describe block.
  Bug was first observed in the `start() unguarded-cycle warning` describe block (Session 10,
  Task C): Test B showed 1 call when it should have been 0 because Test A's `pushToast` call
  leaked into the shared spy instance.
- Fix impact: zero double-clear failures, no regressions.
- Test result: **264/264 passing** (24 files) after this step alone.

**Step 2 — Export `ESCAPE_NODE_TYPES` + `hasEscapeOnCycle` from `validation.ts`**

Step 2a — `src/utils/validation.ts` diff:
-const ESCAPE_NODE_TYPES = new Set<string>(['router', 'condition', 'guardrail'])
+export const ESCAPE_NODE_TYPES = new Set<string>(['router', 'condition', 'guardrail'])

-function hasEscapeOnCycle(
+export function hasEscapeOnCycle(


Step 2b — `src/store/simulationStore.ts` diff:
// Line 29
-import { detectCycle } from '../utils/validation'
+import { detectCycle, ESCAPE_NODE_TYPES, hasEscapeOnCycle } from '../utils/validation'

// Lines 2727–2734 (formerly hand-inlined .some() lambda)

const ESCAPE_TYPES = new Set(['router', 'condition', 'guardrail'])

const cycleTypeById = new Map(cycleNodes.map((n) => [n.id, n.type]))

const hasEscape = cyclePath.some((id) => {

const t = cycleTypeById.get(id)

return t !== undefined && ESCAPE_TYPES.has(t)

})

if (hasCycle && !hasEscape) {

if (hasCycle && !hasEscapeOnCycle(cyclePath, cycleNodes, ESCAPE_NODE_TYPES)) {


- DRY debt from Session 10 Task C fully resolved — inline escape-check lambda replaced with
  the canonical `hasEscapeOnCycle` import. No logic change, pure deduplication.
- `ESCAPE_NODE_TYPES` is now the single source of truth; adding a new escape-capable node type
  (e.g. `evaluator`, `tryCatch`, `retry`) only requires one change in `validation.ts`.

**Build & Test Status (Prompt 9)**
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run test` | ✅ **264/264 passing** (24 files) |
| Test delta vs. Session 9 | +17 (247 → 264) |

**Known decisions / debt carried forward**
- `vitest.config.ts` previously had no `clearMocks`/`restoreMocks` — any test written before
  this fix that relied on shared spy state across tests may now behave differently. None were
  found in this sweep; re-verify if flakes appear on pre-Prompt-9 describe blocks.

---

### Prompt 10 — Pre-Push CI Script ✅

**New file: `scripts/pre-push-check.ps1`**

Features implemented:
- ✅ **Safety checks**: Node ≥ 18, npm exists, `package.json` in cwd (fail-fast on missing prerequisites)
- ✅ **Sequential pipeline**: `typecheck → build → tests` with fail-fast on any step
- ✅ **Build size report**: total dist KB + gzip estimate printed on success
- ✅ **`-DryRun` switch**: prints `[DRY RUN] Would run: <cmd>` for all 3 steps, exits 0 — no side effects
- ✅ **Timestamped logging**: `[HH:mm:ss]` prefix on every major action line
- ✅ **Emoji output**: emitted via `[char]` / `[char]::ConvertFromUtf32()` (no literal Unicode — avoids
  PowerShell encoding issues on Windows terminals with non-UTF-8 codepage)

**Key design decision — `Invoke-Npm` stderr handling:**
Vite writes build progress to stderr. PowerShell strict mode (`$ErrorActionPreference = 'Stop'`)
treats any stderr output as a terminating error, which would false-fail every build step.
Fix: `Invoke-Npm` helper temporarily sets `$ErrorActionPreference = 'SilentlyContinue'`
during the Vite build step only, then restores it — so real npm failures (non-zero exit code)
still terminate the script correctly.

**Dry-Run output (verified):**
[22:23:02] Starting AgentFlow Studio pre-push checks...
[22:23:02] Node.js v20.19.5 detected (>= v18 OK)
[22:23:02] npm v10.8.2 detected
[22:23:02] package.json found
[22:23:02] === DRY RUN MODE ===
[DRY RUN] Would run: npm run typecheck
[DRY RUN] Would run: npm run build
[DRY RUN] Would run: npm run test -- --run
[22:23:02] Dry run complete. No commands executed.


**Full-run output (verified):**
[22:25:33] Starting AgentFlow Studio pre-push checks...
[22:25:40] Typecheck passed
[22:25:56] Build passed (✓ built in 10.01s)
[22:26:03] Tests passed (264 passed, 5.34s)
📦 Build size: 965 KB (gzip estimate: ~338 KB)
✅ AgentFlow Studio pre-push check passed.
Typecheck ✅ | Build ✅ | Tests ✅


**Build & Test Status (Prompt 10)**
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ 965 KB / ~338 KB gzip |
| `npm run test` | ✅ 264/264 passing |
| Script dry-run | ✅ exits 0, no commands executed |
| Script full-run | ✅ all 3 steps pass, size report printed |

**Next steps / wiring options**
- [ ] Wire as a Git pre-push hook: `cp scripts/pre-push-check.ps1 .git/hooks/pre-push` (or a
  thin `.git/hooks/pre-push` shell wrapper that calls `pwsh -File scripts/pre-push-check.ps1`)
- [ ] Add as a GitHub Actions step by calling `pwsh -File scripts/pre-push-check.ps1` in a
  `windows-latest` runner, or adapt the same logic to a `run: |` bash block for `ubuntu-latest`
- [ ] Consider a `-StepOnly typecheck|build|test` param for faster targeted runs during development



## Handoff — 2026-06-23 (Session 10: cycle detection, unguarded-cycle warning, start() gate)

### Task A — detectCycle utility ✅
- New `detectCycle(nodes, edges): CycleResult` in `src/utils/validation.ts` (line 45, exported).
- Algorithm: iterative DFS with grey/black coloring (no recursion — safe on large graphs).
- Time O(V+E), space O(V) auxiliary + O(E) adjacency index.
- Handles: self-loops, disconnected subgraphs, triangle cycles, multi-path cycles.
- 4 unit tests appended to `src/utils/validation.test.ts`.
- **Correction made during implementation**: task brief said "drop beside `validateGraph` in
  `canvasStore.ts`" — but `validateGraph` actually lives in `src/utils/validation.ts`; `canvasStore.ts:19`
  only imports it. Implementation correctly targets `validation.ts`.

### Task B — hasEscapeOnCycle + unguarded-cycle warning in validateGraph ✅
- **Critical discovery**: first integration attempt wired `detectCycle` as a hard error + blocked
  `start()`. This broke 8 previously-green tests including core loop semantics, forkFromSnapshot,
  and the blueprint gallery validation check.
- **Root cause**: `MAX_NODE_VISITS = 2` (simulationStore.ts:159) is the engine's actual cycle
  safety net. Cycles are a first-class supported pattern — `corrective-rag.json` is a deliberately
  cyclic blueprint (retriever→guardrail→router→llm→retriever, self-correcting RAG). A hard block
  on all cycles violates this design.
- **Correct invariant**: a cycle is **unsafe** only if no `router`/`condition`/`guardrail` node
  sits on the cycle path (no possible escape). A cycle with an escape node is valid by design.
- New `hasEscapeOnCycle(cyclePath, nodes, escapeTypes)` and `ESCAPE_NODE_TYPES` constant added
  to `src/utils/validation.ts` — both **unexported** (export decision deferred, see DRY debt below).
- `validateGraph` now pushes a **warning** (not an error) when a cycle has no escape node.
  Guarded cycles push nothing.
- 5 new tests in `src/utils/validation.test.ts`:
  - A: unguarded triangle → 1 warning
  - B: guarded triangle (router on path) → 0 warnings
  - C: corrective-rag pattern → 0 warnings ✅ confirmed
  - D: self-loop on agent node → 1 warning
  - E: linear chain → 0 warnings
- `corrective-rag.json` triggers 0 cycle warnings — confirmed by Test C and by the existing
  blueprint-gallery error-check test staying green.

### Task C — start() unguarded-cycle toast gate ✅
- Added to `src/store/simulationStore.ts` after the `executionQueue.length === 0` guard:
  - Reads `{ nodes, edges }` from `useCanvasStore.getState()`
  - Calls `detectCycle`, inlines escape-check (see DRY debt)
  - Pushes `useToastStore.getState().pushToast(..., 'warning')` if unguarded cycle detected
  - **Does NOT block execution** — `MAX_NODE_VISITS` is the runtime guard
- Two new imports added (lines 29–31 area):
  - `import { detectCycle } from '../utils/validation'`
  - `import { useToastStore } from './toastStore'`
- 2 new tests in `src/store/simulationStore.test.ts` (describe: `start() unguarded-cycle warning`):
  - A: all-agent triangle → pushToast called once with 'warning' tone, isActive true ✅
  - B: router on cycle path → pushToast NOT called, isActive true ✅
- **Bug caught during test writing**: Vitest's `vi.spyOn` returns the same mock instance when
  re-spying an already-mocked method (no `clearMocks` in `vitest.config.ts`). Test B initially
  showed 1 call (leaked from Test A). Fix: `pushToast.mockClear()` after each `vi.spyOn`. See
  DRY/debt note below.

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (pre-existing chunk warnings only) |
| `npm run test` | ✅ 254/254 passing (24 files) |
| Test delta | 247 → 254 (+7 net across 3 tasks) |

### Pre-flight Audit — executeLiveNode (Prompt 6 readiness, 2026-06-23)

Seven questions answered before wiring real LLM calls into non-LLM node types.
All findings are ground-truth from direct file inspection — not assumptions.

**Q1 — executeLiveNode signature**
- File: `src/store/simulationStore.ts`, lines 1156–1159
- Signature: `const executeLiveNode = async (node: AgentFlowNode, nodeId: string): Promise<unknown>`
- Return: `Promise<unknown>` — every branch returns a node output object stored into `nodeOutputs`.
  Not `Promise<void>`.

**Q2 — What is still faked in Live mode**
- `case 'llm'` (line 1168): **real** — calls `streamChat()` abstraction, no fake helpers.
- `case 'tool'` / `case 'retriever'` (lines 1206–1207): **stubbed** — `fakeOutputFor(node, get().userInput)`.
- `default:` branch (line 1457): **stubbed** — `fakeStreamTextFor(node)`, `fakeTokensFor(node)`,
  `fakeOutputFor(node, get().userInput)`. Covers `agent`, `supervisor`, `loop`, and all unhandled types.

**Q3 — Full switch branch list in executeLiveNode**
`start` (1162) · `llm` (1168) · `tool`/`retriever` (1206–1207, fall-through) · `mcpServer` (1220) ·
`httpRequest` (1253) · `condition` (1303) · `router` (1309) · `guardrail` (1346) · `evaluator` (1386) ·
`join` (1435) · `output` (1450) · `default` (1457)

**Q4 — llmConfigStore is NOT a stub**
- Fully implemented. State: `activeProvider`, `settings: Record<ProviderId, ProviderSettings>`,
  `ollamaModels`, `settingsOpen`, `liveError`.
- Key accessor: `getConfig(): ResolvedLLMConfig` (lines 53–56) — returns
  `{ provider, settings: { ...settings[activeProvider] } }`.
- API key is at `config.settings.apiKey` (field on `ProviderSettings` in `src/llm/types.ts:28`),
  not a separate store method.
- `refreshOllamaModels()` makes a real `listOllamaModels()` fetch to `/api/tags`.
- **Correction**: the previous session brief that called this "a stub" was incorrect.
  It is already wired for real provider config and is consumed by the `'llm'` case today.

**Q5 — evalStore is NOT a stub, but is scoped to test-case evaluation only**
- State: `testCases: EvalTestCase[]`, `runs: EvalRun[]`, `evalOpen: boolean`.
- `addRun(run: EvalRun)` records a whole scored eval pass — not per-node trace entries.
- Per-node trace recording lives in `simulationStore`'s own trace state.
- **evalStore is not the right target for per-node execution results.**
  Any new node-result recording should go into `simulationStore`'s existing trace mechanism.

**Q6 — Only one real `fetch()` inside executeLiveNode — NOT an LLM call**
- Line 1280, inside `case 'httpRequest'`: `resp = await fetch(url, { method, headers, body, signal })`
- This is the user-configured HTTP Request node (arbitrary endpoint), not an LLM provider.
- Actual LLM traffic goes through `streamChat()` (line 1188) in `src/llm/` — executeLiveNode
  itself contains no direct fetch to any LLM endpoint.

**Q7 — AgentFlowNodeData LLM fields (src/types/index.ts:54)**
| Field | Line | Status |
|---|---|---|
| `model?: string` | 59 | ✅ exists |
| `modelOverride?: string` | 61 | ✅ exists (Live-mode per-node override) |
| `systemPrompt?: string` | 62 | ✅ exists |
| `temperature?: number` | 63 | ✅ exists |
| `maxTokens` | — | ❌ does NOT exist — zero matches across whole file |

- **Action required before Prompt 6**: any code that needs a per-node token cap must either
  add `maxTokens?: number` to `AgentFlowNodeData` or use a module-level default constant.
  No per-node knob for it exists today.

**Next: Prompt 6 — wire real LLM calls into non-LLM node types inside executeLiveNode.**
Primary targets: `default:` branch (agent/supervisor/loop), then optionally `tool`/`retriever`.
`llm` case is already real — do not touch it.

### Decisions & Known Debt

**Decision: ESCAPE_NODE_TYPES and hasEscapeOnCycle are not exported from validation.ts**
- Both remain unexported (`const`, not `export const`) — export surface change deferred.
- `simulationStore.ts` inlines a local `ESCAPE_TYPES = new Set(['router', 'condition', 'guardrail'])`
  and a local escape-check lambda instead of importing them.
- **DRY debt**: if `ESCAPE_NODE_TYPES` ever expands (candidates: `evaluator`, `tryCatch`, `retry` —
  all branch conditionally per NodeType union), the inline copy in `simulationStore.ts` must be
  updated manually alongside `validation.ts`.
- **Resolution path**: export both symbols in a targeted PR, replace inline copy.

**Decision: no `clearMocks: true` in vitest.config.ts**
- `vi.spyOn` on an already-mocked method returns the same spy instance — call counts leak across
  tests in the same describe block unless `mockClear()` is called explicitly after each `vi.spyOn`.
- **Resolution path**: add `clearMocks: true` to `vitest.config.ts` in a housekeeping PR. Low risk,
  high benefit — prevents this class of false-positive flake globally.

**Note on NodeType escape candidates (from pre-flight)**
- Full `NodeType` union (src/types/index.ts:5–38):
  `start · llm · agent · tool · memory · output · condition · router · guardrail · join · loop ·
  humanInLoop · supervisor · swarmWorker · retriever · mcpServer · structuredOutput · map ·
  codeExecutor · evaluator · subgraph · longTermStore · memoryWriter · planner · subagent ·
  computerUse · a2aAgent · multimodalInput · tryCatch · retry · httpRequest · note · group`
- `evaluator`, `tryCatch`, `retry` branch conditionally and could be added to `ESCAPE_NODE_TYPES`
  in a future pass if users report false-positive warnings on graphs using those node types as
  cycle guards.

### Known edge cases / deferred
- `detectCycle` is unwired from `start()` directly — only the warning toast uses it indirectly.
  The hard-block path was intentionally removed (see Task B discovery note).
- `vitest.config.ts` `clearMocks` housekeeping PR deferred to a future session.
- ESCAPE_NODE_TYPES export deferred — inline DRY copy in `simulationStore.ts` is the current state.

---

## Handoff — 2026-06-21 (Session 9: snapshots, command palette, animated edges, Python export)
> Note: the session brief that kicked this off called itself "Session 8" — renumbered to 9
> here since a Session 8 entry (full-graph PNG/auto-layout/JSON I/O) already existed below.

### Task A — Named Flow Snapshots (manual save slots) ✅
- New `src/store/snapshotStore.ts` (`FlowSnapshot`, `saveSnapshot`/`restoreSnapshot`/
  `deleteSnapshot`/`_loadFromStorage`), persisted to `localStorage` under
  `agentflow-snapshots-v1`, max 10 slots (oldest evicted via `.slice(-10)`), every
  `localStorage` call wrapped in try/catch so quota errors or a missing `localStorage`
  (e.g. the Vitest node test env) never throw to the UI.
  **Flagged, not blocking**: CLAUDE.md says "No localStorage / sessionStorage" — treated
  this task's explicit, detailed localStorage contract as a deliberate scoped exception
  (manual local-only save slots are impossible without it); flag if that wasn't intended.
- New `src/components/SnapshotModal.tsx` (named-slot list, Save Current/Restore/Delete,
  empty state, "X / 10 slots used" footer), wired through `uiStore.snapshotOpen` +
  `setSnapshotOpen` (added to `closeAllModals`), a new Bookmark button in `Navbar.tsx`
  (next to the minimap toggle), `Ctrl+Shift+S` in `useKeyboardShortcuts.ts`, and a new
  Canvas-section row in `ShortcutsModal.tsx`. Mounted in `App.tsx`.
- Tests: 4 new in `src/store/snapshotStore.test.ts` (save copies + dedupes by reference,
  10-slot eviction, delete-by-id, restore calls `canvasStore.loadGraph`) — written and
  watched fail (module didn't exist) before implementing, per TDD.
- Browser-verified: opened via button and via `Ctrl+Shift+S`, Save Current disabled on an
  empty canvas, saved/restored/deleted a real snapshot, footer badge updated live.

### Task B — Command Palette (Ctrl+K) ✅
- New `src/utils/commandPalette.ts` (`PaletteCommand`, `scoreCommand` — empty query→1,
  starts-with→3, contains→2, no match→0), 3 new tests written and watched fail before
  implementing.
- New `src/components/CommandPalette.tsx` — custom fixed overlay (not the shared `Modal`,
  per the brief's own layout spec), 12 commands grouped Canvas/View/Snapshots/Export/
  Simulation, sorted by group then score, ↑/↓/Enter navigation, disabled rows greyed out
  and inert on Enter, backdrop-click and a local capture-phase Escape listener (mirrors
  `Modal.tsx`'s own pattern — needed because the global Escape handler is gated by
  `isEditableTarget` and would never see the event while the palette's search input has
  focus). Every command's disabled condition and action reuses the **exact** existing
  store call/condition from `Navbar.tsx`/`useKeyboardShortcuts.ts` (e.g. Export Python is
  gated on `hasErrors || liveMode`, matching the real button — not the brief's looser
  "isRunning" wording).
- `uiStore.commandPaletteOpen`/`setCommandPaletteOpen` added (+ `closeAllModals`).
  `Ctrl+K` wired in `useKeyboardShortcuts.ts` **above** the `isEditableTarget` early
  return, since it's required to fire even while focus sits in an unrelated text input.
  New Canvas-section row in `ShortcutsModal.tsx`. Mounted in `App.tsx`.
- Browser-verified: `Ctrl+K` opens the palette from a cold reload (confirmed it survives
  HMR-vs-fresh-mount edge cases), all 5 groups render with correct disabled states on an
  empty canvas, typing "minimap" filters to one row, Enter toggles the minimap and closes
  the palette, a disabled row's Enter is a no-op, Escape and backdrop-click both close it.

### Task C — Animated Edge Flow Mode ✅
- `uiStore.animatedEdgesEnabled`/`toggleAnimatedEdges` (1 new test, written/failed first).
- `FlowEdge.tsx`: applies an `edge-flow-animated` class to `BaseEdge` when
  `animatedEdgesEnabled && particleRole === null` — mutually exclusive with the existing
  `showParticles = particleRole !== null` gate by construction, so double-animation with
  an active simulation is structurally impossible, not just empirically unobserved.
- `index.css`: `@keyframes edge-flow` + `.edge-flow-animated` (8/6 dash, -28px offset over
  1.2s), with a `prefers-reduced-motion` override.
  **Real bug found + fixed**: every edge already carries React Flow's own `animated: true`
  flag, and the library's bundled `.react-flow__edge.animated path` rule (2 classes + a
  type selector) outranks a single custom class — without `!important` on both the base
  rule and its reduced-motion override, the toggle was a silent no-op. Confirmed live:
  before the fix `getComputedStyle` showed the library's `stroke-dasharray: 5px` even with
  the class applied and toggled on; after, it correctly shows `8px, 6px` (animation itself
  reads `none` in the headless preview because that environment's `prefers-reduced-motion`
  is `true` — confirmed via `matchMedia`, not a bug).
- Navbar toggle: **used `Waves`, not `Zap`** as instructed — `Zap` is already the icon for
  the pre-existing "Live" mode button in the same toolbar; reusing it here would have put
  two identical-icon buttons side by side.
- Browser-verified live via a real imported edge (no drag-and-drop needed — fed a minimal
  `CanvasDocument` straight through the existing hidden file input's `change` handler, the
  same mechanism Session 8 used to verify Save/Open).

### Task D — LangGraph Python Export Improvements ✅
- **Discovery first**: the brief's stated "current behaviour" didn't match the actual file
  for two of the four items — `router` nodes already emit a real `targets = {...}` dict +
  classifier when a model is on canvas (existing, currently-passing tests pin that exact
  shape), and there is no `ToolNode(tools=[])` stub or `data.isStartNode` field anywhere in
  the codebase (`tools: string[]` belongs to `agent`/`subagent`, not `tool`). Re-scoped all
  four improvements to real, non-overlapping gaps instead of forcing the brief's literal
  snippets over already-correct or nonexistent code:
  1. **Router routes from edge labels** — when `data.routes` is empty but outgoing edges
     carry labels, those labels now drive the classifier (`routes`) instead of falling
     into the generic "no model on canvas" placeholder. Declared `data.routes` (the
     existing, tested path) is untouched.
  2. **ToolNode on `agent`** — an `agent` node with non-empty `data.tools` now emits
     `# Tools: ...` + `tool_node = ToolNode(tools=[...])` (bare identifiers) and a
     conditional `from langgraph.prebuilt import ToolNode` import; empty-tools agents are
     unchanged.
  3. **START edge dedup** — `wireStart()` now dedupes by target identifier across both the
     Start-node loop and the Multimodal-Input entry-point loop. Reproduced the real bug
     first (two Start nodes wired to the same target emitted `add_edge(START, "x")`
     twice — a single edge's source+target dedup was already handled incidentally by
     `spliceOutNodes`'s tail filter, but cross-Start-node dedup was not).
  4. **Header comment** — every export (including the empty-canvas message) now starts
     with the `# Generated by AgentFlow Studio ...` block, ahead of the pre-existing
     `"""Generated by AgentFlow Studio."""` docstring (kept, not replaced).
- Tests: 6 new in `codeExporter.test.ts` (router-from-labels + placeholder-still-works,
  ToolNode-present + ToolNode-absent, START dedup, header), all written and watched fail
  for the right reason before implementing. **50/50 passing in that file, 0 regressions.**
- Browser-verified: opened the Export Python panel on a live 3-node graph (imported via
  the hidden file input) and confirmed the header block renders as the first lines.

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (921.64 kB / 280.18 kB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only, unrelated to this session) |
| `npm run test` | ✅ 247/247 passing (24 files) |
| Browser verification | ✅ all 4 tasks exercised live via preview tools — see per-task notes above |
| Console errors | ✅ none observed |

### Known edge cases / deferred
- Snapshot slots are local-only (no cross-device sync) by design — see the localStorage
  flag under Task A.
- `CommandPalette`'s "Clear Canvas" command calls `clearCanvas()` directly with no confirm
  step, unlike the Navbar "New" button's `ConfirmDialog` — the brief didn't specify a
  confirmation UX for the palette and adding one would need new cross-component state.
- Router routes derived from edge labels (Task D #1) only apply when `data.routes` is
  empty; a router with some declared routes and some merely-labeled edges still uses only
  the declared list, unchanged from prior behavior.

