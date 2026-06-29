---
name: tracelog-formatter
description: >
  This skill should be used when adding simulation trace output, formatting
  TraceLog entries, or debugging what gets logged during graph execution.
  Activates when the user says "add logging for X", "show trace output",
  "TraceLog not showing", or "format simulation events".
allowed-tools:
  - Read
  - Edit
  - Grep
---

## Procedure

1. Read the TraceLog component in COMPONENTS.md to understand the entry schema.
2. Identify the event type: node_start / node_complete / node_error / edge_data / sim_start / sim_end.
3. Each trace entry must include: timestamp (ms), nodeId, nodeType, eventType, payload (optional).
4. Emit trace events from the simulation engine — not from React components.
5. Keep payloads small: log IDs and primitives, not full objects.
6. Error entries must include: error.message, error.code, affected nodeId.
7. Do not log on every render tick — only on state transitions.

## Entry Format

{ ts: number, nodeId: string, nodeType: string, event: TraceEventType, payload?: unknown }
