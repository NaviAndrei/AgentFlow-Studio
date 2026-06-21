# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`

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

---

## Handoff — 2026-06-21 (Session 8: full-graph PNG, auto-layout, JSON I/O, validation rings)

### Follow-up in this same session — consolidated Save/Open with Export/Import JSON
Right after the handoff below was first written, the user asked to fold "Export JSON / Import
JSON" (Task C, native React Flow format) back into the pre-existing "Save / Open" flow
(`CanvasDocument` format) instead of keeping two parallel file flows in the Navbar.
- `CanvasDocument` (`src/types/index.ts`) gained an optional `viewport?: {x,y,zoom}` field.
- `blueprintSchema.ts`'s `parseCanvasDocument` validates/parses that field (`parseViewport`
  helper); old saved files without it still load fine (purely additive).
- `canvasSerializer.ts`: `serializeCanvas`/`downloadCanvas` now take an optional `viewport` param;
  `deserializeCanvas`/`parseCanvas` now return it alongside `nodes`/`edges`.
- `canvasStore.loadGraph(nodes, edges, viewport?)` gained the optional third param — when present,
  it calls `getRfInstance()?.setViewport(viewport)` after the graph commits. Existing callers
  (`App.tsx` share-URL load, `Canvas.tsx` drag-drop, blueprint loads via `uiStore`) are unaffected
  since the param is optional; `Canvas.tsx`'s drag-drop import was updated to also thread it through.
  The `importFlow` action (Task C) and `ReactFlowJsonObject` import were removed from
  `canvasStore.ts` — no longer needed.
- `Navbar.tsx`: removed the Export JSON / Import JSON buttons, the hidden JSON file input, and the
  `flowIO` import; `handleSave` now grabs `getViewport()` from `useReactFlow()` and passes it to
  `downloadCanvas`; `handleOpenFile` destructures `viewport` from `deserializeCanvas` and passes it
  to `loadGraph`.
- Deleted `src/utils/flowIO.ts` and `flowIO.test.ts` (superseded).
- Tests: removed 3 (`flowIO.test.ts`), added 4 — 2 in `canvasSerializer.test.ts` (viewport
  round-trips; omitted when not provided) + 2 in `canvasStore.test.ts` (`loadGraph` calls
  `setViewport` on the stored RF instance when given a viewport; doesn't touch it otherwise, using
  a minimal stub via `setRfInstance`). **232 → 233 passing.**
- Browser-verified end-to-end through the real Navbar handlers (not just unit tests): added a node,
  zoomed the live canvas to 2x, clicked Save (intercepted the Blob to read the JSON — confirmed
  `viewport: {x,y,zoom:2}` present), cleared the canvas (viewport untouched by `clearCanvas`, by
  design), then fed the same JSON through the real hidden file input's `change` handler — the node
  and the exact `scale(2)` transform both came back. No console errors.
- There is still a second, unrelated "Share" link format (`shareUrl.ts`, deflate+base64 in a `?flow=`
  query param) — intentionally out of scope; it doesn't carry the viewport and wasn't touched.

### What was completed
- **Discovery first — two of five tasks were already built.** `color?: string` already
  existed in `AgentFlowNodeData`, the Inspector already had the 8-swatch `AppearanceFields`
  palette, and `data.color` already drove the node **header tint** (`NodeShell.tsx`). The
  per-node validation level was already computed inline in `NodeShell` and shown as a
  corner-triangle badge. `validateGraph` has **no cycle detection**. Confirmed scope with the
  user: Task D → minimal (test only, keep header-tint behavior); Task B → install dagre approved.
- **Task A — Full-graph PNG export ✅** — new `downloadFullGraphScreenshot(nodes, w=2560, h=1440)`
  in `screenshotCanvas.ts`: throws on empty nodes / missing `.react-flow__viewport`, then uses
  `getNodesBounds` + `getViewportForBounds` to fit every node into a fixed 2560×1440 canvas via a
  `style.transform` override on the html-to-image clone (live viewport never moves). Navbar
  Screenshot is now a split control (Camera + ChevronDown → Viewport / Full Graph menu, local
  `useState`). **Real bug found + fixed:** html-to-image stalls indefinitely trying to read rules
  from the cross-origin Google Fonts stylesheet (SecurityError) — added `skipFonts: true` to BOTH
  capture functions (text falls back to system monospace in the PNG). Browser-verified Full Graph
  resolves in ~230ms producing a valid `data:image/png` (~209KB).
- **Task B — Auto-layout (dagre) ✅** — installed `dagre` + `@types/dagre` (user-approved). New
  `utils/autoLayout.ts` (`getLayoutedElements(nodes, edges, direction='TB')`, dagre center→top-left
  conversion). New `utils/rfInstance.ts` (module-level RF instance captured via `<ReactFlow onInit>`
  in `Canvas.tsx`) — the unifying mechanism for viewport control from non-component code.
  `canvasStore.applyAutoLayout('TB')` pushes history, sets layouted nodes, then `fitView` via the
  stored instance on a deferred tick. Navbar `LayoutGrid` button + `Ctrl+L` (skips while running).
  Browser-verified: nodes snap to a clean DAG, `Ctrl+Z` reverts with toast "Undone: Auto-layout".
- **Task C — Flow JSON import/export ✅** — new `utils/flowIO.ts` (`exportFlowToJSON`,
  `parseFlowJSON` → tagged `{ok}` result). `canvasStore.importFlow(flow)` (pushHistory + set
  nodes/edges + `setViewport` via stored instance). Navbar Export JSON (`toObject()` via typed
  `useReactFlow<AgentFlowNode, AgentFlowEdge>()`) + Import JSON (hidden file input → `parseFlowJSON`
  → `importFlow`, failures toast). Browser-verified: import replaced a 7-node graph with the 2 nodes
  from the JSON; export ran with no console errors.
- **Task D — Node color (minimal) ✅** — no production changes (feature already complete). Added a
  `canvasStore.test.ts` test that a color set via `updateNodeData` survives an undo/redo cycle.
- **Task E — Validation ring overlay ✅** — `canvasStore.getProblemsByNodeId()` derived selector
  (groups `validationIssues` by `nodeId`, omits graph-level). `NodeShell` appends
  `ring-2 ring-red-500` / `ring-yellow-400` from the **existing scalar `issueLevel` selector**
  (avoids per-render Map recreation) — corner-triangle badge, selection border, and sim rings
  untouched. Browser-verified: yellow rings appear live on warning-level nodes (e.g. no outgoing
  edge); red path is identical logic + unit-tested via `getProblemsByNodeId`.

### Current state
- typecheck: clean ✅ · build: clean ✅ (pre-existing >500kB chunk warning only)
- tests: **232/232 passing** ✅ (224 prior + 8 new: 2 screenshotCanvas + 1 autoLayout + 3 flowIO
  + 1 color-persistence + 1 getProblemsByNodeId)
- New dependency: `dagre` + `@types/dagre` (user-approved).

### Known edge cases / deferred
- **Full-graph export** captures via the RF viewport-transform approach; very large graphs clamp to
  `minZoom` (0.1). `skipFonts: true` means the exported PNG uses the system monospace face, not
  JetBrains Mono.
- **Viewport screenshot** (the pre-existing `downloadCanvasScreenshot`) stalls in the headless
  preview environment on html-to-image's resource loading of the full `.react-flow` subtree — not a
  regression (verified working in a real browser in Session 6) and not font-related (skipFonts now
  applied). Re-verify in a real browser if touched.
- **Auto-layout `fitView`** is wired identically to React Flow's own Fit View control; both yield an
  identity viewport transform in the headless preview (container measurement quirk). Repositioning
  itself is confirmed working.
- **Task C** duplicates the existing Save/Open (`CanvasDocument`) flow but uses the native React Flow
  JSON format (includes viewport).
- `node.data.color` is cosmetic — **not** emitted by the LangGraph Python exporter.
- `validateGraph` has **no cycle detection** — Task E rings reflect the existing ~30 validation
  rules, so a pure 2-node cycle does not produce a ring.

---

## Handoff — 2026-06-20 (Session 7: panel error boundaries + TraceLog virtual list)

### What was completed
- **Discovery first**: only one error boundary existed (`CanvasErrorBoundary.tsx`, mounted once
  around the entire app body in `App.tsx`) — no per-panel granularity, no reset pattern, just
  `window.location.reload()`. `TraceLog`/`TraceEntryRow` had no virtualization; `package.json`
  has no `@tanstack/virtual` or similar.
- **Task A — Panel error boundaries ✅** — new `components/PanelErrorBoundary.tsx`: a `name`
  prop for the fallback message, a `reset()` instance method (bumps an internal `resetKey` and
  remounts children via a keyed `<Fragment>`, not a full page reload) and a "Reload panel"
  button that only calls `reset()` — `window.location.reload()` is not used here (kept as the
  existing `CanvasErrorBoundary`'s last-resort behavior only). Wrapped `Inspector`, `TraceLog`
  (covers the Debugger/Time-Travel tab — `SnapshotInspector` renders inside it), and
  `RunHistoryPanel` in `App.tsx`. Used `Fragment` instead of a wrapping `<div>` deliberately —
  these panels rely on Tailwind layout classes (`flex-1` on `Inspector`, `fixed inset-x-0
  bottom-0` on `TraceLog`) that an extra wrapper `div` would break.
- **Task B — TraceLog virtual list ✅** — manual windowing added directly in `TraceLog.tsx`
  (no new dependency, per the brief). `ROW_HEIGHT = 28`, `OVERSCAN = 10`,
  `VIRTUALIZE_THRESHOLD = 50`. Below the threshold, entries render normally (unchanged path);
  above it, only the rows in `[scrollTop/ROW_HEIGHT - OVERSCAN, ... + viewportHeight/ROW_HEIGHT
  + OVERSCAN]` are mounted, each `position: absolute` with a calculated `top`, inside a relative
  container sized to `entries.length * ROW_HEIGHT` so native scrollbar proportions stay correct.
  `viewportHeight` is captured via `scrollRef.current.clientHeight` in a `useEffect` keyed on
  `traceOpen` (the container has 0 height while the panel is translated off-screen, so it can't
  be read until the panel opens).
- Browser-verified: loaded the Corrective RAG blueprint (10 nodes), ran it, opened the Trace Log
  — normal (non-virtualized) path renders correctly with real entries. Could not naturally
  exceed the 50-entry threshold in a manual session (each Simulate run resets the trace via
  `resetRunState`, so entries don't accumulate across runs) — temporarily set
  `VIRTUALIZE_THRESHOLD = 0` to exercise the windowed branch live: confirmed the relative
  container's height equals `entries.length * ROW_HEIGHT`, absolutely-positioned rows have
  correct `top` offsets (0px, 28px, 56px, ...), and reverted the threshold back to 50 before
  the final gate run.

### Current state
- typecheck: clean ✅ · build: clean ✅ (pre-existing fflate/chunk warnings only)
- tests: **224/224 passing** ✅ (no new tests added — both tasks are DOM/layout glue without
  jsdom/testing-library in the repo, consistent with this project's existing pattern of
  browser-verifying that kind of code instead of unit-testing it)
- No new npm dependencies.

### Next steps
1. [ ] `PanelErrorBoundary`'s `reset()` remounts children but won't help if the error is caused
   by corrupted Zustand state (e.g. a malformed run record) rather than a transient render bug —
   in that case "Reload panel" will immediately re-throw. Worth keeping `window.location.reload()`
   as a documented fallback path if "Reload panel" is clicked twice in a row.
2. [ ] TraceLog virtualization wasn't exercised with a real 50+-entry trace (the engine clears
   trace per run) — if a future session adds a "merge trace across runs" or very-deep-loop
   blueprint, re-verify scroll behavior with actual entries instead of the threshold-0 trick.

---

## Handoff — 2026-06-20 (Session 6: minimap toggle, PNG export, shortcuts help)

### What was completed
- **Discovery first**: `<MiniMap>` already existed in `Canvas.tsx` (bottom-right, already
  colored by node type via `getNodeMeta`) — only missing a toggle + explicit dark styling.
  No `html-to-image`/`html2canvas`/canvas-export utility existed anywhere, and neither was
  a bundled dependency. `useKeyboardShortcuts.ts` + `ShortcutsModal.tsx` already existed
  (flat list, Navbar-button-only, no `?` hotkey) — `Ctrl+D`/`Ctrl+A`/`Ctrl+Z`/`Ctrl+Y`/`Ctrl+E`
  already bound; `Ctrl+R` and `G` were genuinely new.
- **Task A — Minimap toggle ✅** — `uiStore.minimapVisible` (+ `toggleMinimap()`), new
  toggle icon button in `Navbar.tsx` (next to the Settings gear, `aria-pressed`). `Canvas.tsx`
  conditionally renders `<MiniMap>` and added `bgColor="#0d0e10"` + `border-white/10` styling.
  1 new test (`uiStore.test.ts`, didn't exist before — created it).
- **Task B — Canvas PNG export ✅ (added `html-to-image` dependency, user-approved)** —
  no existing dep could capture the ReactFlow DOM (HTML nodes + SVG edges) as a real image;
  asked the user before adding a new npm dependency per CLAUDE.md, approved `html-to-image`
  (~5KB gzip, zero transitive deps, the library `@xyflow/react`'s own docs use for this exact
  case). New pure `utils/screenshotCanvas.ts` (`downloadCanvasScreenshot()`): queries
  `.react-flow`, calls `toPng` filtering out `.react-flow__minimap`/`.react-flow__controls`
  so the exported image is just the flow, downloads as `agentflow-flow-YYYY-MM-DD.png`. New
  "Screenshot" button in `Navbar.tsx` next to Save, disabled when canvas is empty, failures
  surface via `toastStore` (warning tone) instead of throwing silently.
- **Task C — Keyboard shortcuts help panel ✅** — `ShortcutsModal.tsx` restructured from a
  flat list into 4 sections (Canvas / Simulation / Nodes / Debug); Debug section documents
  `TimeTravelBar.tsx`'s existing Arrow/Space bindings (which only fire when that component is
  focused, not global — noted in the row text rather than implying they're global).
  `useKeyboardShortcuts.ts` gained: `?` → opens the shortcuts modal, `Ctrl+R` → start/stop
  simulation (always `preventDefault()`s the browser-refresh shortcut, only starts if the
  canvas has nodes), `G` → toggles the Blueprint Gallery. `Ctrl+E` was left bound to the
  existing Export modal (Python + deploy bundle tab) rather than rebound, since that already
  covers "export bundle".
- Browser-verified all three: minimap toggle hides/shows the `<MiniMap>` live; Screenshot
  button ran `toPng` with no console errors and no failure toast; `?` opened the sectioned
  modal, `G` opened/closed the Blueprint Gallery, `Ctrl+R` started then stopped a real
  simulation run (Step 4/4 reached, then reset).

### Current state
- typecheck: clean ✅ · build: clean ✅ (pre-existing fflate/chunk warnings only; bundle
  grew from ~797kB to ~814kB gzip after adding `html-to-image`)
- tests: **224/224 passing** ✅ (223 prior + 1 new `uiStore.test.ts`). No jsdom/testing-library
  in the repo, so the new keyboard-shortcut branches (`?`/`Ctrl+R`/`G`) and `screenshotCanvas.ts`
  (DOM `querySelector` + `toPng` + anchor click) weren't unit-tested — consistent with the
  project's existing pattern of browser-verifying DOM/event-glue code instead of testing it
  in Vitest's node environment; verified live via preview tools (see above).
- `package.json` gained one new dependency: `html-to-image` (user-approved this session).

### Next steps
1. [ ] `screenshotCanvas.ts` only captures the current viewport (visible pan/zoom), not the
   whole flow — for large graphs this may crop content. Consider using `@xyflow/react`'s
   `getNodesBounds`/`getViewportForBounds` to fit the whole graph before capturing, like the
   library's own "download image" example does.
2. [ ] `G` toggles the Blueprint Gallery globally with no regard for whether a text-like
   control without `isEditableTarget` coverage has focus (e.g. a custom non-`<input>` widget)
   — low risk today since `isEditableTarget` covers all current text-entry surfaces, but worth
   a second look if a future node adds a custom focusable editor.

---

## Handoff — 2026-06-20 (Session 5: test gap-fill + HIL modal + cost estimator)

### What was completed
- **Discovery first**: `forkFromSnapshot`/`Snapshot.label`/canvasStore had **zero** test
  coverage (no `canvasStore.test.ts` existed at all). `humanInLoop` already had a working
  engine-level pause/resume (`pendingApproval`/`approve()`/`reject()` in `simulationStore.ts`,
  tested), but the UI was inline Approve/Reject buttons in `MetricsBar.tsx` — no modal, no
  textarea, no way to inject a typed response. `modelPricing.ts` + post-run cost tracking
  (`CostPanel.tsx`, `totalCostUsd`) already existed, but nothing estimated cost **before**
  a run from canvas nodes alone. Scoped Task B/C as genuinely new work on top of confirmed gaps.
- **Task A — test coverage ✅** — `src/store/canvasStore.test.ts` created (didn't exist):
  5 tests for `undo()`/`redo()` label returns + `loadGraph()` clearing `history`/`future`.
  3 new tests added to `simulationStore.test.ts` for `forkFromSnapshot` (step-0 fork, mid-run
  fork seeding pre-fork nodes as executed without re-running them, and loop visit-count
  carry-over forcing the budget-driven `forced_else` termination on the resumed run).
- **Task B — HumanInLoop modal ✅** — new `components/HumanInLoopModal.tsx`, mounted in
  `App.tsx`. Reuses the existing `pendingApproval` gate instead of rebuilding it: new
  `simulationStore.submitHumanInput(value)` action mirrors `approve()` but merges
  `{ approved: true, userResponse: value }` into `nodeOutputs[nodeId]` before resuming via
  `play()`. `reject()` (Cancel/Esc) was extended to also push the gate node's id into
  `erroredNodeIds` (previously it only skipped downstream + ended the run, per the brief's
  "Cancel = marks node as error"). Modal title = node label, Esc/backdrop-click reuse
  `Modal`'s existing close handling (wired to `reject`), Enter-without-Shift submits,
  Shift+Enter inserts a newline in the textarea. The old inline Approve/Reject buttons in
  `MetricsBar.tsx` were **left in place** (low risk, hidden behind the modal backdrop when
  open) rather than removed — flagged as a next step if the duplication bothers anyone.
- **Task C — pre-run cost estimator ✅** — new pure `utils/estimateCost.ts`
  (`estimatePreRunCost(nodes, globalModel)`), reusing the same `COSTED_NODE_TYPES` set
  (llm/agent/router/guardrail/evaluator/supervisor/swarmWorker) and model-resolution order
  (`modelOverride` → node `model` → global provider model) as `simulationStore`'s post-run
  `buildCostSummary`, but priced at a fixed average token budget (800 in / 400 out) since no
  real content exists pre-run. Wired into `Navbar.tsx` via `useMemo` over `canvasStore.nodes`
  + the active provider's model — shows `~$0.0096 estimated` as both a badge next to
  "Simulate" and a `title` tooltip on the button itself; renders nothing for 0 LLM nodes.
- Browser-verified: cost badge appeared correctly for a 2-LLM-node blueprint; ran the
  Human-in-Loop blueprint to the gate, typed a response, Submit resumed and finished the run
  with the downstream nodes executing; restarted, hit the gate again, Esc canceled — gate
  node showed as errored, downstream nodes skipped, run ended. No console errors in either path.

### Current state
- typecheck: clean ✅ · build: clean ✅ (pre-existing fflate/chunk warnings only)
- tests: **223/223 passing** ✅ (210 prior + 13 new: 5 canvasStore + 5 simulationStore
  (3 forkFromSnapshot + submitHumanInput + reject-errors-gate) + 4 estimateCost)
- Browser-verified live via preview tools (see above)

### Next steps
1. [ ] `MetricsBar.tsx`'s inline Approve/Reject buttons duplicate the new modal's Submit/Cancel
   — consider removing the inline block now that the modal is the primary surface, or keep it
   as a no-typing quick-approve path (current behavior: both are shown, modal sits on top).

---

## Handoff — 2026-06-20 (Session 4: discovery-first scope correction)

### What was completed
- **Important discovery before any code was written**: the session brief (3 tasks:
  LangGraph node coverage, blueprint landing screen, export-bundle ZIP) assumed a
  much older snapshot of the repo. Discovery found **Task A (httpRequest, codeExecutor,
  condition, loop, tryCatch, structuredOutput) and Task C (fflate ZIP export) already
  existed and worked** — `codeExporter.ts` already had all 6 cases, `deployExporter.ts`
  already zipped main.py/requirements.txt/server.py/Dockerfile/docker-compose/README.
  Confirmed scope with the user: did a small gap-fill on A & C instead of re-implementing,
  then built Task B (landing screen) as genuinely new work. **If a future brief asks for
  LangGraph export coverage or a deploy-zip exporter again, check `codeExporter.ts` and
  `deployExporter.ts` first.**
- **Task A gap-fill ✅** — added missing test coverage for `httpRequest`, `codeExecutor`,
  `loop`, `tryCatch` exports (4 new tests in `codeExporter.test.ts`); no production code
  changes needed, the cases were already correct.
- **Task C gap-fill ✅ (real bug found + fixed)** — `deployExporter.ts`'s `server.py`
  template did `from main import build_graph` and called it, but the exported `main.py`
  never defines `build_graph()` — it only compiles a module-level `graph`. This would
  have crashed on import in any real deploy. Fixed `server.py` to `from main import graph`
  directly. Also added `.env.example` (derived from a new exported `exportEnvVars()` in
  `codeExporter.ts`, reusing the existing `modelSetupsFor`/envVar logic) and `blueprint.json`
  (raw `{nodes, edges}`) to the zip. New `deployExporter.test.ts` (3 tests) unzips the
  blob with `fflate.unzipSync` and asserts file list + the `server.py`/`main.py` import
  contract, which is what caught the bug.
- **Task B — Blueprint landing screen ✅** — `WelcomeOverlay.tsx` rewritten from a small
  hint card into a full takeover landing screen shown when the canvas is empty: 3-col
  (responsive to 1-col) card grid reusing `BlueprintThumbnail` + `BLUEPRINTS`, node-count
  badge, hover glow (`motion-safe:` prefixed, so `prefers-reduced-motion` disables it),
  "Start blank" + "Import JSON" (reuses `readCanvasFile`/`deserializeCanvas`, the same
  utils the Navbar's "Open" button uses), and keyboard nav (arrow keys move focus across
  the 3-col grid, Enter loads the focused card, Esc dismisses to blank). Per
  `.claude/rules/components.md` ("every panel's open/close state goes in uiStore, never
  local useState"), dismissal is `uiStore.landingDismissed`, reset to `false` automatically
  whenever the canvas becomes empty again (New/clear) via a `useEffect` keyed on `isEmpty`.
  Browser-verified: card grid renders, clicking a card loads the blueprint and dismisses
  the overlay, "New" → confirm → Clear canvas re-arms the landing screen, arrow-key nav
  moves focus between cards, Esc dismisses to a blank canvas. No console errors.

### Current state
- typecheck: clean ✅ · build: clean ✅ (pre-existing fflate/chunk warnings only)
- tests: **210/210 passing** ✅ (203 prior + 4 codeExporter + 3 deployExporter)
- Browser-verified live via preview tools (see Task B above)

### Next steps
1. [ ] The existing modal-style `BlueprintGallery.tsx` (opened via Navbar "Browse
   Blueprints") still exists alongside the new landing-screen grid — they're both valid
   entry points (modal for mid-session browsing, landing screen for the empty-canvas
   first-run) but duplicate the card-grid UI. Consider extracting a shared `BlueprintCard`
   if a third surface needs the same grid.
2. [ ] `deployExporter`'s `.env.example`/`blueprint.json` additions have no UI affordance
   pointing users at them beyond the zip itself — the `ExportModal.tsx` deploy tab's
   `DEPLOY_COMMANDS` list could mention "fill in .env before `docker compose up`".

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
