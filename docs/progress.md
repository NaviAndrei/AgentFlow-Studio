# AgentFlow Studio — Session Handoff
> Update at end of every session before /clear.
> Start next session: `@CLAUDE.md @docs/progress.md`
> Older handoffs: `docs/progress-archive.md`

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

### Current state
- typecheck: clean ✅ 
- build: clean ✅ 
- tests: 181/181 passing ✅ (158 existing + 23 new httpRequest validation tests)
- HTTP Request node visible in Emerging palette group

### Next steps (from feature analysis)
1. [ ] Node output caching + partial re-execution (T3-1) — biggest ROI, order-of-magnitude speedup on re-runs
2. [ ] Run diff in Run History (T1-2) — quick win, data already exists
3. [ ] Time-travel debugger (T2-2) — snapshot per step for backward inspection

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
Components work → also `@COMPONENTS.md`
Stores/simulation → also `@ARCHITECTURE.md`
Something seems wrong → check `@DECISIONS.md` first