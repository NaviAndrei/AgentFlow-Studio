---
name: add-node
description: Use when adding a new node type to AgentFlow Studio (e.g. evaluator, webhook). Walks the 9 required registration locations so none is missed, then verifies with typecheck/build/test.
---

# Add Node — 9 Required Registration Locations

> Invoke when adding a new node type to AgentFlow Studio. See also `.claude/rules/nodes.md`
> and the "9-location node registration pattern" entry in `DECISIONS.md`.

## Prerequisite
Confirm the new node type name with the user before starting (e.g., `evaluator`, `webhook`).

## Steps — 9 Required Registration Locations

### Core 7 (from ARCHITECTURE.md)
1. `src/types/index.ts` — Add the new type to `AgentFlowNodeType` union
2. `src/nodes/[NodeType]Node.tsx` — Create the node component file
3. `src/nodes/index.ts` — Export the new node component
4. `src/App.tsx` — Add to the `nodeTypes` map passed to `<ReactFlow>`
5. `src/components/NodePalette.tsx` — Add palette entry with icon and color
6. `src/store/canvasStore.ts` — Add default data shape in `addNode()`
7. `src/utils/codeExporter.ts` — Add Python code generation case

### Additional 2 (required for typecheck)
8. `src/data/hints.ts` — Add entry to `HINTS.nodes` (uses `satisfies Record<AgentFlowNodeType, string>`)
9. `src/utils/nodeDefaults.ts` — Add case to the `switch` statement (exhaustiveness check)

## Verification
After all 9 locations are updated:
```bash
npm run typecheck && npm run build && npm run test
```

## Output
- Confirmation that all 9 locations were updated
- Typecheck + build + test results
- Note any existing tests that may need updating
