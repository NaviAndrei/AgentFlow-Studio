---
name: typescript-strict
description: >
  This skill should be used when reviewing or writing TypeScript code,
  when type errors appear, or when the user says "fix the types",
  "no any", "clean up TypeScript", or "add proper types".
  Enforces strict TypeScript patterns for the AgentFlow codebase.
allowed-tools:
  - Read
  - Edit
  - Bash
---

## Procedure

1. Run: `npx tsc --noEmit` to get the full list of type errors.
2. Fix in this priority order:
   - Remove all `any` — replace with proper types or `unknown` with narrowing
   - Add explicit return types to all exported functions
   - Use discriminated unions for node types (NodeType enum + data shape per type)
   - Replace loose `object` types with specific interfaces
3. For React components: props interface required, no implicit children.
4. For Zustand stores: state type and actions type exported separately.
5. Never use type assertions (`as X`) to silence errors — fix the root cause.

## AgentFlow Node Typing Pattern

type NodeData<T extends NodeType> = T extends NodeType.LLM ? LLMNodeData :
  T extends NodeType.Tool ? ToolNodeData : BaseNodeData
