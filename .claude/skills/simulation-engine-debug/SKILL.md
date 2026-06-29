---
name: simulation-engine-debug
description: >
  This skill should be used when the simulation is not running, nodes are
  stuck, graph execution stops unexpectedly, or when the user says
  "simulation not working", "node not executing", "graph is stuck",
  or "simulation hangs". Covers the AgentFlow simulation engine specifically.
allowed-tools:
  - Read
  - Bash
  - Grep
---

## Procedure

1. Read ARCHITECTURE.md section on the simulation engine to understand tick logic.
2. Identify the failure mode:
   - Silent hang → check for unresolved Promises or missing node completion callbacks
   - Partial run → find the last node that completed, check its outgoing edges
   - Crash → check browser console for the exact error + stack trace
3. Grep for the stuck node type: `grep -r "NodeType.X" src/simulation/`
4. Check the node registry — is the stuck node type registered with a handler?
5. Trace the data flow: what data should enter the node, what should exit?
6. Add temporary console.log at node entry/exit points to confirm execution.
7. Check for circular dependencies in the graph that cause infinite loops.

## Common Failure Patterns

- Node handler not registered → engine skips silently
- Missing output port data → downstream nodes never trigger
- Async handler without await → node marked complete before finishing
- Edge connected to wrong handle ID → data routed to wrong node
