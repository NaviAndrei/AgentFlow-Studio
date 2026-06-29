---
name: state-machine
description: >
  This skill should be used when a component or node has complex boolean
  state (multiple flags, conditional rendering chains), when modeling
  simulation states, or when the user says "model this behavior",
  "node states are getting complicated", or "simulation state machine".
allowed-tools:
  - Read
  - Edit
---

## Procedure

1. List all possible states as an enum or union type — never use multiple booleans.
   BAD:  isRunning, isPaused, isError, isComplete (4 booleans = 16 combinations)
   GOOD: type SimState = 'idle' | 'running' | 'paused' | 'error' | 'complete'
2. Define valid transitions as a map: from state → allowed next states.
3. Create a transition function: (current: SimState, event: SimEvent) => SimState
4. Handle impossible states at the type level — if it can't happen, it can't be typed.
5. Put the state machine in its own file: `src/machines/<name>.machine.ts`.
6. Connect to Zustand via a single `simState` key — never store transition logic in the store.

## AgentFlow Node State Pattern

Each node follows: idle → queued → running → complete | error
Transitions are driven by the simulation engine tick, not user input.
