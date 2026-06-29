# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`
> See docs/progress-archive.md for Sessions 1–25 (Sessions 14–25 archived 2026-06-26).

## Handoff — 2026-06-30 (Session 56 — chore(claude): blocking stop hook + skill/memory updates)

### What was completed
- [x] **Blocking stop hook**: Rewrote `.claude/hooks/on_stop_reminder.py` — replaced the old auto-fill/TODO-sync logic with a strict mtime check comparing `.claude/.session_start` vs `docs/progress.md`. If `progress.md` hasn't been touched since session start, the hook now prints `{"decision":"block",...}` and exits `2` (blocking session end) instead of silently auto-filling a template. Forces the user to run `/handoff`/"end session" before stopping.
- [x] **CLAUDE.md auto-memory sync**: Appended a `## Auto-Memory & Feedback Rules` section to the bottom of `CLAUDE.md` listing all 4 active feedback/project memory files with one-line summaries, so the always-loaded CLAUDE.md context now mirrors what's in the cross-session auto-memory store.
- [x] **New skill — `component-design-audit`**: Added `.claude/skills/component-design-audit/SKILL.md` (read-only: `Read`, `Grep` only). Audits modified components against `COMPONENTS.md` (directory placement, PanelRail usage, z-index hierarchy, panel registry vs. inline JSX, `uiStore`-owned panel state, no inline styles, typed props interface) and outputs a severity table.
- [x] **`decisions-audit` skill optimization**: Replaced Step 1 of `.claude/skills/decisions-audit/SKILL.md` with a grep-first strategy — `grep -i "<term>"` against `DECISIONS.md` first; only read the matched ±20-line ranges, or fall back to a full read if grep finds nothing. Cuts the typical-case cost from a full-file read (~3000 tokens) to a targeted grep (~50 tokens).

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | N/A — config/skill/hook files only, no TypeScript touched |
| `npm run build` | N/A — no app code touched |
| `npm run test` | N/A — no app code touched |
| Browser verification | N/A — Claude Code tooling change, not app-observable |

### Decisions made this session
- The stop hook was fully replaced rather than extended — the prior version's auto-fill/TODO-sync behavior conflicted with the new requirement to *block* (not silently patch) when `progress.md` is stale, so keeping both would have caused the hook to auto-fill a stub and then immediately pass the staleness check it was supposed to enforce.
- `component-design-audit` and `decisions-audit` are both read-only (`Read`/`Grep` only, no `Edit`/`Write`) — audits should surface findings for the user to act on, not self-apply fixes.

### Known edge cases / deferred
- First run after this change: `.claude/.session_start` did not exist, so the new hook will initialize it (`STATE_FILE.touch()`) and allow once before the blocking check becomes active on the *next* session.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```

---

## Handoff — 2026-06-29 (Session 52 — perf: lazy-load Inspector via React.lazy + Suspense)

### What was completed
- [x] **Discovery first**: Confirmed `App.tsx` (lines 41-50, 82-97) still has the Session 51 `inspectorEverOpened` mount-on-first-open guard exactly as documented — initialized from live `inspectorOpen`, flipped permanently `true` on first open via `useEffect`, gates `<Inspector />` vs. the duplicated collapsed-strip JSX. Baseline `npm run build`: single `index-*.js` bundle at 978.75 KB / 295.97 KB gzip — no separate Inspector chunk existed yet (Session 51 only deferred *mounting*, not the *module fetch*, since `Inspector` was still a static `import`).
- [x] **Fix**: Converted `App.tsx`'s `import { Inspector } from './components/Inspector'` to `const Inspector = lazy(() => import('./components/Inspector').then((m) => ({ default: m.Inspector })))` (named export, so the dynamic import result is remapped to a `default` for `lazy()`). Wrapped `<Inspector />` in `<Suspense fallback={null}>` inside the existing `inspectorEverOpened` conditional — the `PanelErrorBoundary name="Inspector"` wrapper still wraps everything outermost, unchanged. `Inspector.tsx` itself was not touched, per constraint.
- [x] Mount-guard behavior unchanged: `React.lazy()` only changes *how* the module loads (deferred `import()` on first render of `<Inspector />`), not *when* it mounts (still gated by `inspectorEverOpened`).

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (same pre-existing CSS/chunk-size/fflate dynamic-import warnings only, no new ones). **`Inspector-tBCissuc.js` now emitted as its own chunk: 48.38 KB / 10.98 KB gzip.** Main bundle: 978.75 KB → 930.60 KB (−48.15 KB), gzip 295.97 KB → 286.28 KB (−9.69 KB). |
| `npm run test` | ✅ 468/468 passing (50 files), no regressions |
| Browser verification | ✅ via `preview_network`/`preview_click`/`preview_eval`: on initial load, `Inspector.tsx` and its sub-imports (`buildSuggestionPrompt.ts`, `SuggestionDiffPreview.tsx`, `wordDiff.ts`, etc.) are **not** fetched at all — confirmed by inspecting the full network request list before any interaction. Clicked `button[aria-label="Show inspector"]`: `Inspector.tsx` and its dependency chain fetch only at that point, `<aside>` mounts (1086 chars of HTML), no console errors (`preview_console_logs` level=error → empty). No loading-spinner flash observed (fallback is `null` per constraint) and no layout jank from the panel sliding in. |

### Decisions made this session
- Used `.then((m) => ({ default: m.Inspector }))` to adapt the named `export function Inspector()` to the default-export shape `React.lazy()` requires, rather than adding a `default export` to `Inspector.tsx` — keeps the named-export convention used throughout the codebase intact and avoids touching `Inspector.tsx`.
- Kept `PanelErrorBoundary` as the outermost wrapper (boundary > Suspense > Inspector) rather than Suspense-outermost — an error during the lazy `import()` (e.g. chunk load failure) should still be caught by the existing error boundary, and this required zero changes to `PanelErrorBoundary` itself.

### Known edge cases / deferred
- None — `#6` from the Session 48 `/perf` audit (lazy-load Inspector, deferred pending the mount-guard prerequisite) is now fully closed: both the mount-on-first-open guard (Session 51) and the actual code-split (this session) are in place.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```




---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 55 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/components/Canvas.tsx`
- [x] Modified `src/components/TraceLog.tsx`
- [x] Modified `src/nodes/ConditionNode.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 468/468 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 54 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/components/Canvas.tsx`
- [x] Modified `src/components/TraceLog.tsx`
- [x] Modified `src/nodes/ConditionNode.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 468/468 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 53 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/components/Canvas.tsx`
- [x] Modified `src/components/TraceLog.tsx`
- [x] Modified `src/nodes/ConditionNode.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 468/468 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---

## Handoff — 2026-06-29 (Session 51 — chore: Inspector mount-on-first-open guard)

### What was completed
- [x] **Discovery first**: `Inspector` (`src/components/Inspector.tsx`) was already mounted unconditionally in `App.tsx` — `<Inspector />` rendered every time regardless of `inspectorOpen`. Internally, the component itself does an early-return to a tiny collapsed strip (`Inspector.tsx:2048-2060`) when `inspectorOpen` is false, but that early-return happens *inside* the component, so the module (and its heavy sub-imports: `callLLMDirect`, `mcpClient`, `a2aClient`, `StateInspector`, etc.) is always evaluated/mounted as part of the main bundle/tree regardless of whether the panel is ever opened. No CSS-translate-hidden pattern was found — confirmed it's a conditional-JSX-return pattern, not CSS visibility.
- [x] **Scoped fix (prerequisite only, no `React.lazy()` yet)**: Added `inspectorEverOpened` state in `App.tsx`, initialized from the store's current `inspectorOpen` value (so wide-screen default-open behavior is preserved with no flash). A `useEffect` flips it to `true` the first time `inspectorOpen` becomes `true`, and it never resets — so `<Inspector />` mounts once on first open and stays mounted afterward (avoids remount cost on every close/reopen cycle). Before first open, `App.tsx` renders a duplicate of Inspector's own collapsed-strip JSX (same `PanelRightOpen` button) directly, so the toggle affordance is present without ever importing/mounting the real component.
- [x] Did not add `React.lazy()` — logged as the explicit follow-on step below per task instructions.

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (pre-existing chunk-size and CSS warnings only, no new ones) |
| `npm run test -- --run` | ✅ 468/468 passing, 50 files |
| Browser-verify | ✅ Confirmed via `preview_eval`/`preview_click`: on initial narrow-viewport load, `document.querySelector('aside')` returns `null` (Inspector not mounted) while the collapsed `button[aria-label="Show inspector"]` is present and clickable. After clicking it, `<aside>` mounts with the correct persisted width (300px). Clicking "Collapse inspector" hides the `<aside>` again (Inspector's own internal early-return, not unmount) and "Show inspector" reopens it instantly at the same width — no remount flash, no console errors/warnings. |

### Decisions made this session
- Initialized `inspectorEverOpened` from the live `inspectorOpen` value (not hardcoded `false`) so the wide-screen default-open behavior (`widePanelDefault` in `uiStore.ts`) still mounts Inspector immediately on first paint instead of incorrectly showing the collapsed strip for one frame.
- Duplicated the small collapsed-strip JSX into `App.tsx` rather than extracting it into a shared component — it's ~10 lines, used in exactly two places (here and inside `Inspector.tsx`'s own closed-state branch), and extracting it would add an abstraction for a one-time prerequisite step that's about to be superseded by the `React.lazy()` follow-on anyway.

### Follow-on (not done this session — explicitly deferred)
- [ ] Wrap `Inspector` in `React.lazy()` + `<Suspense>` in `App.tsx` now that the mount-on-first-open guard exists, to actually split it out of the main bundle (current bundle is 978 KB / 296 KB gzip, flagged by Vite's chunk-size warning — Inspector is one of the largest contributors given its many sub-imports).

## Handoff — 2026-06-29 (Session 50 — feat: edge condition labels on Condition node branches)

### What was completed
- [x] **Discovery first** (per task instructions) revealed the requested feature was *already mostly built*: `AgentFlowEdge` (`src/types/index.ts:300`) carries a generic `label?: string`, and `FlowEdge.tsx:220-265` already renders it via `EdgeLabelRenderer` with the exact requested style (small text, `bg-surface-2`, bordered, rounded, yellow-tinted when `data.edgeType === 'conditional'`). The real gap: `onConnect` in `canvasStore.ts:251-274` auto-adopts a connection's **named source handle** as the edge label (used by `RouterNode`'s routes today), but `ConditionNode.tsx` never passed its `branches` to `NodeShell` as `extraOutputs` — so a Condition node only ever exposed one single anonymous output handle, and new edges drawn from it never picked up a condition label. Pre-authored blueprint JSON (e.g. `react-agent.json`'s `condition-1` → `llm-1`/`output-1` edges) worked around this by hardcoding `"label"` directly on the edge, which is why labels appeared in some blueprints already.
- [x] **Fix**: `ConditionNode.tsx` now passes `extraOutputs={branches}` to `NodeShell`, mirroring `RouterNode`'s existing pattern. This gives each branch (`if: condition`, `else`, etc.) its own named source handle, so `onConnect`'s existing label-adoption logic — and the existing `EdgeLabelRenderer` render path — now work for Condition nodes exactly as they already did for Router nodes. Zero changes to `FlowEdge.tsx`, `canvasStore.ts`, or edge data shape.
- [x] No new util/logic was introduced, so no new test was added (label rendering is pure existing render glue per the gate's own carve-out).

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (same pre-existing >500kB chunk + fflate dynamic-import warnings only, unrelated) |
| `npm run test` | ✅ 468/468 passing (50 files), no regressions |
| Browser verification | ✅ loaded the **ReAct Agent** blueprint (closest shipped example of a Condition node with branch edges — no blueprint is literally named "Conditional Branch"); confirmed via DOM query that `.react-flow__edgelabel-renderer span` renders `"continue"` and `"done"` on the two edges out of the `Done?` condition node. Also confirmed via handle inspection that the node now exposes two named handles (`data-handleid="continue"`, `data-handleid="done"`) instead of one anonymous handle — proving fresh user-drawn edges from a Condition node will now auto-label too, not just pre-authored blueprint edges. |

### Decisions made this session
- Did not add `font-mono` or otherwise restyle the edge label per the task's "small mono text" description — the existing label styling (`text-[10px]`, `bg-surface-2`, bordered, rounded) already matches the node-shell aesthetic and is shared by every edge kind (manual labels, router routes, now condition branches); changing it would be an unrequested, unscoped style change to a component used everywhere, not specific to this feature.
- Did not auto-set `edge.data.edgeType = 'conditional'` (the dashed yellow stroke) when a label is adopted from a Condition/Router handle. That styling is currently an explicit user choice via the edge right-click menu (`EDGE_KIND_OPTIONS` in `Canvas.tsx`), and Router edges never auto-set it either — changing this would be a scope-expanding behavior change to existing Router edges, not something requested.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```



---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 52 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/components/Canvas.tsx`
- [x] Modified `src/components/TraceLog.tsx`
- [x] Modified `src/nodes/ConditionNode.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | TODO: X/Y passing (test run failed or timed out) |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 51 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/components/Canvas.tsx`
- [x] Modified `src/components/TraceLog.tsx`
- [x] Modified `src/nodes/ConditionNode.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 468/468 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---

## Handoff — 2026-06-29 (Session 48 — perf: fix mode, targets #3 + #5 from /perf audit)

### What was completed
- [x] **#3 — Canvas.tsx**: hoisted `defaultEdgeOptions`/`proOptions` (previously inline objects passed to `<ReactFlow>` on every render) to module-level `DEFAULT_EDGE_OPTIONS`/`PRO_OPTIONS` constants; hoisted the inline `onPaneClick={() => setEdgeMenu(null)}` arrow into a `useCallback`.
- [x] **#5 — TraceLog.tsx:127**: wrapped `trace.filter((e) => matchesFilter(e, filter))` in `useMemo` keyed on `[trace, filter]` — was recomputing on every render while a run streams live.
- [x] **#5 — Inspector.tsx:138-143 — N/A, not applied**: the flagged `edges.filter/map/filter/filter(Boolean)` chain lives inside `handleSuggest`, an async `onClick` handler in `SystemPromptSuggest` that reads a one-off snapshot via `useCanvasStore.getState()`. It already runs once per click, not once per render — wrapping it in `useMemo` would violate the Rules of Hooks (can't call a hook inside a nested non-component function) and would fix nothing. Closed as a false positive from the original `/perf` audit grep, which matched the `.filter/.map` shape but missed that it's handler code.
- [x] Searched `Inspector.tsx` render bodies (all ~33 `*Fields` components + the main `Inspector()` export) for a genuine render-time `useMemo` candidate to replace the N/A item. Found none worth flagging: the only other collection ops in render bodies are over small static/short lists (`ICON_OPTIONS` ~21 entries in `AppearanceFields`, `serverList` from `useMCPStore`, prompt-registry `candidates` in `SystemPromptRegistryLink`) — memoizing these would be noise, not a real win.

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean (re-run after each of the 2 fixes) |
| `npm run build` | ✅ clean (same pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ 468/468 passing (50 files) — re-run after each fix, no regressions |
| Browser verification | N/A — internal refactor (memoization/constant-hoisting), no observable behavior change |

### Decisions made this session
- Declined to force a `useMemo` onto handler-scoped code just to satisfy the audit checklist literally; flagged the false positive back instead of producing a broken/no-op change.
- Did not widen the Inspector.tsx search beyond render bodies of exported/declared functions — handler-internal `.filter`/`.map` calls (e.g. `toggleTool`, `ComputerUseFields`'s `allowed.filter`) are correctly out of scope for `useMemo` for the same reason as the N/A item.

### Known edge cases / deferred
- ~~**#6 — Lazy-load panels/Inspector**~~ — **CLOSED Session 52**: Inspector now code-splits via `React.lazy()`/`Suspense` in `App.tsx`, confirmed as a separate 48.38 KB chunk in `npm run build` output. Original note retained below for the still-open panels (`EvalPanel`, `CostPanel`, etc. — out of scope for Session 52, only Inspector was requested): all panels >100 lines (`EvalPanel`, `CostPanel`, `PromptRegistryPanel`, `ProblemsPanel`, `MCPServersPanel`, `RunHistoryPanel`, `TraceLog`) and `Inspector.tsx` (2122 lines) are statically imported and unconditionally mounted in `App.tsx`; visibility is CSS-driven (`translate-x`/`translate-y` slide on an `open` boolean), not via `{open && <Panel/>}`. `React.lazy()` only defers the `import()` until first *render*, so wrapping these as-is would add a `Suspense` flash on initial load without deferring the actual bundle fetch (they're already in the tree at mount). Real fix needs a structural change first: convert to mount-on-first-open (keep mounted afterward so the close slide-out animation still has a DOM node to animate), *then* wrap in `lazy()`. Estimated effort: Medium-High (touches mount lifecycle + animation timing in ~8 files). Highest ROI of the original `/perf` audit list — `Inspector.tsx` alone is a meaningful slice of the 978 KB main bundle the build already flags. Scope as its own session before touching code.
- `#2` (React.memo) and `#4` (useCallback on inline handlers) from the same audit were explicitly excluded from this fix pass per instruction — still open, lower priority (see audit report in conversation history: #2 is mostly redundant given `@xyflow/react`'s internal per-node memo boundary; #4 has ~0 ROI until #2 lands since nothing downstream is memoized yet).

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```

---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 49 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/components/Canvas.tsx`
- [x] Modified `src/components/TraceLog.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 468/468 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---


















---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 47 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/components/Canvas.tsx`
- [x] Modified `src/components/TraceLog.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | TODO: X/Y passing (test run failed or timed out) |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 46 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | TODO: X/Y passing (test run failed or timed out) |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 45 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/store/mcpStore.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | TODO: X/Y passing (test run failed or timed out) |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 44 — cleanup: remove orphaned files â€” 2 files)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 451/451 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 43 — chore: remove orphaned src/test/setup.ts stub)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/llm/types.ts`
- [x] Modified `src/store/spanStore.ts`
- [x] Modified `src/types/index.ts`
- [x] Modified `src/utils/mcpClient.ts`
- [x] Modified `src/utils/spanHelpers.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 451/451 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 42 — chore(claude): configure workspace hooks and custom command guides)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | TODO: X/Y passing (test run failed or timed out) |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 41 — chore(claude): configure workspace hooks and custom command guides)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | TODO: X/Y passing (test run failed or timed out) |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 40 — chore(claude): configure workspace hooks and custom command guides)

### What was completed
- [x] Modified `docs/progress.md`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | TODO: X/Y passing (test run failed or timed out) |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 39 — chore(claude): configure workspace hooks and custom command guides)

### What was completed
- [ ] TODO: no changed files detected — fill in manually
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 421/421 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 38 — fix(simulation): thread abort token into node-step latency delays)

### What was completed
- [x] Modified `.claude/commands/audit.md`
- [x] Modified `.claude/settings.json`
- [x] Modified `CLAUDE.md`
- [x] Modified `docs/progress.md`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 421/421 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 37 — fix(utils): replace abortableDelay polling with single-timer + AbortSignal pattern)

### What was completed
- [x] Modified `.claude/commands/audit.md`
- [x] Modified `.claude/settings.json`
- [x] Modified `CLAUDE.md`
- [x] Modified `docs/progress.md`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 421/421 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-29 -->
## Handoff — 2026-06-29 (Session 36 — chore: update CLAUDE.md architecture, add feature-status command, fix bash selector)

### What was completed
- [x] Modified `.claude/commands/audit.md`
- [x] Modified `.claude/settings.json`
- [x] Modified `CLAUDE.md`
- [x] Modified `docs/progress.md`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | TODO: X/Y passing (test run failed or timed out) |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-28 -->
## Handoff — 2026-06-28 (Session 35 — chore: update CLAUDE.md architecture, add feature-status command, fix bash selector)

### What was completed
- [x] Modified `.claude/commands/audit.md`
- [x] Modified `.claude/settings.json`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 421/421 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 34 — feat(mcp,llm): implement MCP server registry and per-node provider overrides - Create MCPServersPanel slide-in UI for managing external MCP server connections - Integrate registered MCP server lookups in simulationStore with fallback support - Add providerOverride field to LLM/Agent nodes to support dynamic routing - Implement unit tests for per-node provider/model override validation - Support provider overrides in the Python template exporter output - Fix auto_test.py hook to resolve file paths from tool_input parameters - Archive older session handoffs and update documentation logs)

### What was completed
- [x] Modified `.claude/hooks/auto_format.py`
- [x] Modified `.claude/hooks/auto_test.py`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 368/368 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 33 — feat(agents): add session-planner roadmap subagent)

### What was completed
- [x] Modified `docs/layout-fix-log.md`
- [x] Modified `docs/progress-archive.md`
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/components/Inspector.tsx`
- [x] Modified `src/components/Navbar.tsx`
- [x] Modified `src/store/simulationStore.test.ts`
- [x] Modified `src/store/simulationStore.ts`
- [x] Modified `src/store/uiStore.test.ts`
- [x] Modified `src/store/uiStore.ts`
- [x] Modified `src/types/index.ts`
- [x] Modified `src/utils/codeExporter.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 368/368 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 32 — feat(export): add async _aget_relevant_documents override to BaseRetriever)

### What was completed
- [x] Modified `.claude/settings.json`
- [x] Modified `CLAUDE.md`
- [x] Modified `docs/layout-fix-log.md`
- [x] Modified `docs/progress-archive.md`
- [x] Modified `docs/progress.md`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 357/357 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 31 — fix(ux): wire authToken reload warning to real triggers)

### What was completed
- [x] Modified `docs/progress-archive.md`
- [x] Modified `docs/progress.md`
- [x] Modified `src/utils/codeExporter.test.ts`
- [x] Modified `src/utils/codeExporter.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 357/357 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 30 — fix(ux): wire authToken reload warning to real triggers)

### What was completed
- [x] Modified `docs/progress-archive.md`
- [x] Modified `docs/progress.md`
- [x] Modified `src/utils/codeExporter.test.ts`
- [x] Modified `src/utils/codeExporter.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 357/357 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 29 — feat(export): async BaseRetriever override with _aget_relevant_documents)

### What was completed
- [x] Added 3 new TDD tests for async _aget_relevant_documents
- [x] Implemented _aget_relevant_documents async override in BaseRetriever export
- [x] Uses httpx.AsyncClient (no new imports needed)
- [x] Sync _get_relevant_documents preserved — both methods present in generated code
- [x] Modified `src/utils/codeExporter.test.ts` — 3 new tests (all passing)
- [x] Modified `src/utils/codeExporter.ts` — async method emitted for retriever nodes with endpointUrl

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 357/357 passing |
| Browser verification | N/A — code generation change, not UI-observable |

### Decisions made this session
- Added both sync and async methods to BaseRetriever for retriever nodes with endpointUrl
- httpx.AsyncClient over asyncio.to_thread(requests.post) — httpx already imported, native async, no thread overhead
- Async method emitted directly after sync method in generated class body
- Three separate TDD tests: async override present, both methods present, no regression for non-endpoint retrievers

### Known edge cases / deferred
- None — all prior deferred items are now complete

### What to load at resume
@CLAUDE.md @docs/progress.md










---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 28 — fix(ux): wire authToken reload warning to real triggers)

### What was completed
- [x] Modified `docs/progress-archive.md`
- [x] Modified `docs/progress.md`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 354/354 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 27 — feat(ux): warn on mount when tool/retriever nodes have endpointUrl but no authToken)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [x] Modified `src/store/snapshotStore.test.ts`
- [x] Modified `src/store/snapshotStore.ts`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 354/354 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
## Handoff — 2026-06-26 (Session 27 — warnMissingTokens wired to real triggers)

### What was completed
- Extracted the authToken-missing warning logic from `App.tsx`'s inline mount
  effect into `src/utils/warnMissingTokens.ts` (`warnMissingTokens(nodes?)`,
  defaults to reading `useCanvasStore.getState().nodes` when called with no
  argument). `App.tsx`'s mount effect now just calls `warnMissingTokens()`. ✅
- `?flow=` decode callback (`App.tsx`) now also calls
  `warnMissingTokens(result.nodes)` right after `loadGraph` — closes the gap
  noted in Session 25's handoff (the mount-effect warning ran before the async
  decode resolved, so a `?flow=`-restored node never got checked). ✅
- `restoreSnapshot` (`src/store/snapshotStore.ts`) now calls
  `warnMissingTokens(snapshot.nodes)` after `loadGraph`/`markClean` — closes
  the other gap from Session 25 (manual Snapshot Manager restores also ran
  after the one-shot mount check).
- TDD: new `src/utils/warnMissingTokens.test.ts` (3 tests: warns with node
  label, silent on empty list, silent when authToken set) — all failed
  pre-implementation (module didn't exist), all pass after. Added 2 tests to
  `snapshotStore.test.ts` under "restoreSnapshot warns about missing tokens"
  (warns when restored node missing token, silent when token present) — first
  failed pre-implementation as expected, both pass after. Existing
  `App.test.tsx` suite (4 tests) continues to pass unchanged against the
  refactored `App.tsx`, confirming the extraction preserved behavior.

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | ✅ clean (931.88 KB / 282.89 KB gzip; pre-existing >500kB chunk + fflate dynamic-import warnings only) |
| `npm run test` | ✅ **354/354 passing** (34 files), +5 net (349 → 354) |
| Browser verification | N/A — store/utility-level wiring, not independently browser-observable beyond what Session 25's smoke test already covered |

### Decisions made this session
- Single shared helper (`warnMissingTokens`) instead of three copies of the
  filter/toast logic — same check now runs from mount, `?flow=` decode, and
  manual snapshot restore.
- Helper takes an optional `nodes` param (defaulting to live `canvasStore`
  state) so callers that already have the relevant node list in hand
  (`?flow=` decode result, snapshot's own `nodes`) can pass it directly
  instead of re-reading from `canvasStore` after the write.

### Known edge cases / deferred
- None new — this session closes both edge cases flagged in Session 25's
  handoff (the `?flow=` async-resolution gap and the Snapshot Manager restore
  path).

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
---
<!-- auto-prepended by on_stop_reminder.py on 2026-06-26 -->
## Handoff — 2026-06-26 (Session 26 — fix(security+export): authToken excluded from localStorage + BaseRetriever export)

### What was completed
- [x] Modified `docs/progress.md`
- [x] Modified `src/App.tsx`
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | ✅ 349/349 passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
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
Continue from Session 15. Key context: 319/319 tests passing (32 files),
MetricsBar duplicate Approve/Reject buttons removed (modal is now the sole HIL UX).
Next priority: wire real LLM calls into default: branch of executeLiveNode in
src/store/simulationStore.ts (agent/supervisor/loop currently use fakeStreamTextFor
/ fakeOutputFor/fakeTokensFor stubs — confirmed still present via grep, Session 13).
```

## Open TODOs
- [x] Wire `pre-push-check.ps1` as a Git pre-push hook — done (Session 14); `.git/hooks/pre-push` prefers `pwsh`, falls back to `powershell.exe`, warns + exits 0 if neither found
- [x] Wire real LLM calls into `default:` branch of `executeLiveNode` (agent/supervisor/loop) — done (confirmed already implemented, Session 16); remaining fake* stubs are intentional, gating the non-live simulated engine path, not missing live wiring
- [x] Wire real execution into `tool:`/`retriever:` cases of `executeLiveNode` — done (confirmed already implemented, Session 17); both already call `streamChat` identically to `default:`/`llm:`
- [x] Wire `node.data.tools`/`toolName` into the `tool:`/`retriever:` system prompt — done (Session 18); scoped to Option B (system-prompt injection via `buildToolContext`), since no real tool-execution backend exists for plain `tool:` nodes (full dispatch loop remains deferred, see Known Gaps)
- [x] Add `maxTokens?: number` to `AgentFlowNodeData` — done (Session 12); wired into the actual provider request body (was previously display-only)
- [x] Remove inline Approve/Reject buttons from `MetricsBar.tsx` (duplicated by modal) — done (Session 15)
- [x] Wire `tool:`/`retriever:` nodes into real tool-dispatch loop — done (Session 20); HTTP endpoint path via `callTool()` reuse, gated on `node.data.endpointUrl`; LLM-only path remains the fallback
- [x] Expose `endpointUrl`/`authToken` fields on `tool:`/`retriever:` nodes in NodeConfigPanel — done (Session 21); added via shared `ToolEndpointFields` in `Inspector.tsx`
- [ ] Consider `-StepOnly` param for `pre-push-check.ps1` — human — LOW

## Known Gaps (intentionally deferred)
- **Viewport screenshot in headless**: stalls on html-to-image resource loading in the preview env — works in real browser. Not a regression.
- **TraceLog virtualization untested at scale**: engine clears trace per run, so 50+ entries never reached naturally. Re-verify if a merge-trace feature is added.
- **`G` shortcut escape hatch**: fires globally without `isEditableTarget` check — low risk today, re-evaluate if custom focusable editors are added.
- ~~**`on_stop_reminder.py` duplicate hook**: fires multiple times per session
  end producing N identical empty template blocks.~~ — fixed Session 14: guard checks
  if the session-name placeholder is in the first 400 chars before prepending.
