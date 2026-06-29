# AgentFlow Studio — Compact Anchor

## Role
AgentFlow Studio is a React/TS visual AI workflow builder with node-based canvas.

## Invariants (Do Not Violate)
1. Drag state tracked via `useRef`, not `useState` (PanelRail) — `useState` re-render mid-drag collapses the rail.
2. `abortableDelay(ms, token)` for all retry backoff, not `await delay(ms)` — plain delay cannot be interrupted on Abort.
3. `structuredClone(trace)` before archiving to `runHistoryStore`, not spread — spread archives live references, corrupting history.
4. `uiStore` owns ALL panel geometry, no local component state — multiple components read/write these values.
5. Adding a node type requires updating a fixed checklist of 9 locations, enforced by `.claude/rules/nodes.md` and `/add-node`.

## Store Rules
1. `canvasStore` is the exclusive owner of nodes and edges — nothing else reads/writes them directly.
2. No `setState` between `pointerdown`↔`pointerup` (use ref-only storage instead).
3. `simulationStore` is write-only from components — read traces via a selector only.

## Component Rules
1. One node type per file — never merge multiple node types into one file.
2. Node component files must be named `[NodeType]Node.tsx`.
