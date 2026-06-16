# AgentFlow Studio — Session Handoff

> Update this at the end of every session before /clear.
> Start next session with: @CLAUDE.md @docs/progress.md

---

## Handoff — 2026-06-17 (continued)

### What was completed
- PanelRail snap-on-open fix: when TraceLog opens, if rail was dragged low and now violates
  safe zone constraints, snap it instantly to valid position via new useEffect with [traceOpen]
  dependency. Snap updates store + DOM imperatively, disables CSS transition for one frame,
  then re-enables for normal animations.
- Implementation: added useEffect after line 198 in `src/components/PanelRail.tsx` that watches
  traceOpen, reads railOffsetPx as closure, calls clampOffset(), commits to store, updates DOM,
  manages transition timing via setTimeout(0)

### Current state
- All tests passing: 158/158 ✅
- typecheck: clean ✅
- build: clean ✅ (pre-existing fflate/chunk-size warnings)
- Feature verified: user confirmed snap works in dev server preview

### Next steps
- None outstanding. Codebase is stable.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
If working on components: also load `@COMPONENTS.md`
If working on stores/simulation: also load `@ARCHITECTURE.md`
If something seems "wrong" or intentional: check `@DECISIONS.md` first

---

## Handoff — 2026-06-16

### What was completed
- Full `/audit` of `src/` — report delivered, all findings actioned
- Inspector resize rewritten to mirror PanelRail's drag invariants (setPointerCapture,
  imperative `aside.style.width`, single commit on pointerup, `touch-none`,
  `role="separator"` + `aria-label="Resize inspector"`)
- New `CanvasErrorBoundary` (class component) wraps canvas + all panels in App.tsx
  (Navbar stays outside); verified live by forcing a render throw — fallback + Reload
  shown, Navbar stayed usable
- Computer-Use model validation + Inspector dropdown now share `COMPUTER_USE_MODELS`
  (`claude-opus-4-8`, `claude-sonnet-4-6`)
- Navbar Settings/Help icon buttons got `aria-label`s
- `simulationStore.maybeRetry` dead branch collapsed
- Modernized Claude model ids/defaults (`claude-sonnet-4-6`, `claude-opus-4-8`,
  `claude-haiku-4-5`) across nodeDefaults/fakeData/codeExporter/ComputerUseNode/blueprint;
  added pricing entries (legacy ids kept in `MODEL_PRICING` for old canvases)
- Doc reconciliation: CLAUDE.md node color palette (Special section), `runToken` wording
  (number, not nanoid), uiStore panel-visibility wording — across CLAUDE.md,
  ARCHITECTURE.md, `.claude/rules/stores.md`

### Current state
- All tests passing: 158/158 ✅
- typecheck: clean ✅
- build: clean ✅ (pre-existing fflate/chunk-size warnings, unrelated to app)

### Next steps
- None outstanding from this audit pass. Future audits: re-check `MODEL_PRICING` /
  `COMPUTER_USE_MODELS` if Anthropic ships new model ids.

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
If working on components: also load `@COMPONENTS.md`
If working on stores/simulation: also load `@ARCHITECTURE.md`
If something seems "wrong" or intentional: check `@DECISIONS.md` first

---

## Handoff — 2026-06-15

### What was completed
- TraceLog dock fix (`bottom-12 → bottom-0`, closed state `translate-y-full`)
- PanelRail drag system overhaul (ref-only, pointer capture, imperative DOM, blur post-drag)
- PanelRail hover delay (200ms in / 100ms out, CSS group-hover)
- ProblemsPanel component added
- uiStore: railOffsetPx, setRailOffsetPx, clampOffset bounds updated
- Prompt Registry (promptStore, resolvePrompts, PromptRegistryPanel)
- Dataset Import (datasetParser CSV/JSON, EvalPanel)
- Run History (runHistoryStore, RunHistoryPanel, TraceEntryRow, CostBreakdown)
- MCP AbortSignal wiring
- abortableDelay in simulation retry backoff

### Current state
- All tests passing: 158/158 ✅
- typecheck: clean ✅
- build: clean ✅ (pre-existing fflate/chunk-size warnings, unrelated to app)

### Next steps (priority order)
1. `[ ]` Run full codebase audit with Opus 4.8 (audit prompt is in TASKS.md)
2. `[ ]` Address Critical/High findings from audit
3. `[ ]` Address Quick Wins from audit

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
If working on components: also load `@COMPONENTS.md`
If working on stores/simulation: also load `@ARCHITECTURE.md`
If something seems "wrong" or intentional: check `@DECISIONS.md` first
