---
description: State management and Zustand store rules for AgentFlow Studio
paths: ["src/store/**"]
---

# Store Rules — AgentFlow Studio

- **Canvas Data Owner**: `canvasStore` is the exclusive owner of nodes and edges — nothing else reads/writes them directly.
- **Canvas State Invariant**: Canvas data must live in Zustand stores only — never inside React component state.
- **Zustand Hot Path**: No `setState` between `pointerdown`↔`pointerup` to prevent rendering overhead on the hot path (use ref-only storage instead).
- **UI State Owner**: `uiStore` owns shared panel visibility flags and ALL geometry offsets (`railOffsetPx`, `inspectorWidth`). Note: `eval`/`prompt-registry`/`run-history`/`trace` panels deliberately keep their own `*Open` visibility flags in their respective domain stores.
- **Simulation Store**: `simulationStore` is write-only from components. Read traces via a selector and never subscribe components to the whole store.
- **Run Tracking**: Every simulation run gets a unique `runToken` (incrementing number). Abort checks must compare against the current token.
- **Delays**: Use `abortableDelay(ms, token)` in retry backoffs — never use plain `delay()` or `setTimeout`.
- **Trace Archive**: Use `structuredClone` when archiving traces to `runHistoryStore` — never use the spread operator.
