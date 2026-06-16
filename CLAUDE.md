# AgentFlow Studio — Claude Code Memory

<!-- Art direction: AI node-graph editor → dark, precise, geometry-aware
     Stack: React 19 · Vite 6 · TypeScript strict · @xyflow/react v12 · Zustand · Tailwind v4
     DO NOT use this file as a changelog. Log changes in TASKS.md or docs/progress.md. -->

## Commands
```bash
npm run dev          # dev server :3000
npm run build        # production build
npm run typecheck    # tsc --noEmit — run before EVERY commit
npm run test         # Vitest unit tests
```

## Stack
React 19 · Vite 6 · TypeScript strict · @xyflow/react v12 · Zustand · Tailwind v4 · Lucide
Dark only. `bg:#0d0e10` `accent:#00c4cc`. No `any`. No new npm deps without approval.
No localStorage / sessionStorage.

## Layout Geometry — DO NOT CHANGE without updating this section
- **Navbar**: `h-12` = 48px, `top-0`, full width
- **PanelRail**: 272px tall (`6×h-10 + 5×gap-1 + py-1.5`), centered via `top-1/2 -translate-y-1/2`
- **TraceLog**: `h-60` = 240px, **docked `bottom-0`** — was `bottom-12`, DO NOT revert (23px rail clearance)
- **Rail bottom y** @ 800px viewport = 537px. TraceLog top y = 560px. Clearance = 23px.
- **clampOffset**: rail never above Navbar (48px) nor below open TraceLog (240px from bottom)

## Active Stores
| Store | Owns |
|-------|------|
| `canvasStore` | nodes, edges, selection |
| `blueprintStore` | blueprint load/save |
| `simulationStore` | run engine, abort, retries |
| `llmConfigStore` | provider registry |
| `uiStore` | shared panel visibility (gallery/export/shortcuts/etc.), railOffsetPx, inspectorWidth — eval/prompt-registry/run-history/trace panels track their own `*Open` flag in their domain store |
| `promptStore` | prompt registry |
| `evalStore` | eval suite, dataset import |
| `runHistoryStore` | run records, trace archive |

## Invariants — Never Break
- No `setState` between `pointerdown`↔`pointerup` in drag handlers — ref-only hot path
- `touch-action: none` on every draggable trigger
- `setPointerCapture` fires before any `pointermove` handler
- Canvas data lives in Zustand only — never React component state
- One node type per file in `src/nodes/`
- `npm run typecheck && npm run build` must pass before every commit

## Do Not Touch (Intentional — see DECISIONS.md for full rationale)
- `PanelRail` z-index: geometry fix (dock) solved overlap — z-swap buries the rail
- `TraceLog bottom-0`: intentional — reverting to `bottom-12` causes 25px rail overlap
- `isDraggingRef`: ref not state — prevents re-render collapsing rail mid-drag
- `group` class on PanelRail container: CSS group-hover driven, not JS

## Node Color Palette
```
Core:    Start#16a34a  LLM#7c3aed    Agent#4f46e5  Tool#ea580c  Memory#0891b2  Output#dc2626
Flow:    Condition#ca8a04  Router#65a30d  Guardrail#be123c  Loop#475569  Human#db2777
Multi:   Supervisor#b45309  SwarmWorker#0d9488  Subagent#4338ca
Special: ComputerUse#2563eb  Multimodal#be185d  A2AAgent#0f766e  LongTermStore#0e7490
```

## Detailed References (load on demand — not every session)
- Architecture, data flow, engine rules → @ARCHITECTURE.md
- Full component map, z-index stack → @COMPONENTS.md
- Non-obvious decisions with rationale → @DECISIONS.md
- Task backlog, session handoff → @TASKS.md
- Layout fix history → @docs/layout-fix-log.md
- Session handoff/progress → @docs/progress.md
