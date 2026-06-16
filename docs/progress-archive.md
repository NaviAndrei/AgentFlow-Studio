# AgentFlow Studio — Progress Archive
> Older handoffs moved here to keep docs/progress.md lean.

---

## Handoff — 2026-06-16

### What was completed
- Full `/audit` — all findings actioned
- Inspector resize rewritten (setPointerCapture, imperative width, touch-none)
- CanvasErrorBoundary added (class component, wraps canvas + panels)
- COMPUTER_USE_MODELS shared between validation + Inspector dropdown
- Navbar aria-labels, simulationStore dead branch collapsed
- Model ids modernized: `claude-sonnet-4-6`, `claude-opus-4-8`, `claude-haiku-4-5`
- Doc reconciliation across CLAUDE.md, ARCHITECTURE.md, rules/stores.md

### State: 158/158 ✅ · typecheck clean ✅ · build clean ✅

---

## Handoff — 2026-06-15

### What was completed
- TraceLog dock fix (`bottom-12 → bottom-0`)
- PanelRail drag overhaul (ref-only, pointer capture, imperative DOM)
- PanelRail hover delay (200ms in / 100ms out)
- ProblemsPanel added
- Prompt Registry (promptStore, PromptRegistryPanel)
- Dataset Import (datasetParser CSV/JSON, EvalPanel)
- Run History (runHistoryStore, RunHistoryPanel, CostBreakdown)
- MCP AbortSignal wiring + abortableDelay retry backoff

### State: 158/158 ✅ · typecheck clean ✅ · build clean ✅
