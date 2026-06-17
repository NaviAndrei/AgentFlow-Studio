# AgentFlow Studio — Claude Code Memory
<!-- Stack: React 19 · Vite 6 · TS strict · @xyflow/react v12 · Zustand · Tailwind v4 -->

## Commands
```bash
npm run dev          # :3000
npm run build        # production
npm run typecheck    # run before EVERY commit
npm run test         # Vitest
```

## Stack
React 19 · Vite 6 · TypeScript strict · @xyflow/react v12 · Zustand · Tailwind v4 · Lucide
Dark only. `bg:#0d0e10` `accent:#00c4cc`. No `any`. No new npm deps without approval.
No localStorage / sessionStorage.

## Layout Geometry — DO NOT CHANGE without updating COMPONENTS.md
- Navbar: `h-12` (48px), top-0, full width
- PanelRail: 272px tall, centered + railOffsetPx offset
- TraceLog: `h-60` (240px), docked `bottom-0` — DO NOT revert to `bottom-12`
- clampOffset: rail never above Navbar (48px) nor below open TraceLog (240px from bottom)

## Active Stores
| Store | Owns |
|-------|------|
| `canvasStore` | nodes, edges, selection |
| `blueprintStore` | blueprint load/save |
| `simulationStore` | run engine, abort, retries |
| `llmConfigStore` | provider registry |
| `uiStore` | panel visibility, railOffsetPx, inspectorWidth |
| `promptStore` | prompt registry |
| `evalStore` | eval suite, dataset import |
| `runHistoryStore` | run records, trace archive |

## Invariants — Never Break
- No `setState` between `pointerdown`↔`pointerup` — ref-only hot path
- `touch-action: none` on every draggable trigger
- `setPointerCapture` fires before any `pointermove` handler
- Canvas data lives in Zustand only — never React component state
- One node type per file in `src/nodes/`
- `npm run typecheck && npm run build` must pass before every commit

## Node Registration — 9 Locations (not 7)
ARCHITECTURE.md lists 7; two more are required or typecheck fails:
- `src/data/hints.ts` — `HINTS.nodes` uses `satisfies Record<AgentFlowNodeType, string>`; every type must have a hint
- `src/utils/nodeDefaults.ts` — switch must cover every type (exhaustiveness)

## Edit Tool Gotcha — Single-Quoted `.ts` Files
The Edit tool converts straight single quotes `'` to curly quotes inside replaced blocks.
TypeScript cannot parse curly quotes as string delimiters (TS1127 "Invalid character").
Fix: use Python via Bash for any insertion into files that use single-quoted string syntax (e.g. `hints.ts`).

## codeExporter `emit()` — no null args
`emit(...added: string[])` — passing `null` for conditional lines fails type-check.
Use `if (cond) emit('...')` instead of `emit(cond ? '...' : null)`.

## Do Not Touch (see DECISIONS.md)
- `PanelRail` z-index — z-swap buries the rail
- `TraceLog bottom-0` — reverting causes 25px rail overlap
- `isDraggingRef` — ref not state, prevents re-render mid-drag
- `group` class on PanelRail — CSS group-hover, not JS

## References (load on demand)
- Stores, engine, node registration → ARCHITECTURE.md
- Components, z-index, layout details → COMPONENTS.md
- Decision rationale → DECISIONS.md
- Tasks, backlog → TASKS.md
- Session handoff → docs/progress.md
