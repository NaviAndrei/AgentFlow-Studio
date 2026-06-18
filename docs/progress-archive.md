# AgentFlow Studio — Progress Archive
> Older handoffs moved here to keep docs/progress.md lean.

---

## Handoff — 2026-06-17

### What was completed
- **On-canvas node output badges (T1-1) ✅**
  - Implemented in NodeShell.tsx (23 lines)
  - Selector reads simulationStore.trace, findLast via .filter().at(-1) (ES2022 safe)
  - Badge shows below node after run: green for ok, red for error, hidden for skipped/active
  - Native title tooltip with full INPUT + OUTPUT
  
- **HTTP Request node (T2-1) ✅**
  - Implemented across 9 registration locations (7 core + 2 required: hints.ts, nodeDefaults.ts)
  - Native fetch() with AbortSignal, runToken check, timeout via AbortController
  - resolveHttpTemplate helper for {{variable}} interpolation from upstream node outputs
  - Python export: httpx.get/post/etc., sync + async mode, conditional headers/body
  - Validation: URL required, URL format, invalid method, body-on-GET/DELETE warning
  - Node defaults: GET, 10s timeout, empty headers/body, Globe icon, #0369a1 color, Emerging palette
  
- **Documentation updates**
  - CLAUDE.md: added Node Registration (9 locations), Edit tool gotcha (smart quotes), codeExporter emit() constraint
  - ARCHITECTURE.md: updated Node Registration Checklist from 7 to 9 with explicit required stops

### State: 181/181 ✅ · typecheck clean ✅ · build clean ✅

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
