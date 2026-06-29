---
name: zustand-store-ts
description: >
  This skill should be used when adding new state to a Zustand store,
  creating a new store slice, debugging re-renders, or when the user says
  "update the store", "add state for X", "why is this re-rendering", or
  "add a Zustand slice". Do NOT use for React local state (useState).
allowed-tools:
  - Read
  - Edit
  - Grep
---

## Procedure

1. Read the existing store files in `src/store/` to understand current slice structure.
2. Identify the state shape: what keys are needed, what are their TypeScript types.
3. Follow the existing slice pattern in the project — do not invent new patterns.
4. Use selectors to prevent re-renders: never select the whole store object.
   BAD:  const store = useStore()
   GOOD: const nodeCount = useStore(s => s.nodes.length)
5. Name actions as verbs: addNode / removeEdge / resetSimulation.
6. Add devtools middleware label matching the slice name.
7. Export the slice type alongside the slice itself.

## Re-render Checklist

- Are object/array references stable (use immer or spread correctly)?
- Are selectors returning primitives or memoized references?
- Is `shallow` equality needed for multi-key selects?

## Verification

Run the app and open Redux DevTools — confirm the new slice appears and actions dispatch correctly.
