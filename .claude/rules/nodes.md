---
description: Naming and registration rules for flow nodes in AgentFlow Studio
paths: ["src/nodes/**"]
---

# Node Rules — AgentFlow Studio

- **Single Node Type Per File**: One node type per file — never merge multiple node types into one file.
- **Node Component Naming**: Node component files must be named `[NodeType]Node.tsx` — maintain this naming convention.
- **Node Colors**: Node colors are defined in the design system — do not introduce new colors without updating the palette.
- **Node Registration Checklist (9 Locations)**: When adding a new node type, touch all 9 registration locations (updating the 7 listed in `ARCHITECTURE.md` + 2 additional locations to avoid typecheck failures):
  1-7. As specified in `ARCHITECTURE.md` Node Registration Checklist.
  8. `src/data/hints.ts` — `HINTS.nodes` uses `satisfies Record<AgentFlowNodeType, string>` (every node type must have a hint).
  9. `src/utils/nodeDefaults.ts` — The `switch` statement must cover every type to maintain exhaustiveness.
