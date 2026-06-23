---
description: General development style and dependency rules for AgentFlow Studio
paths:
  - "src/**"
---

# General Rules — AgentFlow Studio

- **Type Safety**: Strictly no `any` types. Ensure all TypeScript variables and function signatures are fully and explicitly typed.
- **Dependencies**: Do not install or introduce new `npm` dependencies without explicit approval.
- **State Persistence**: Do not use `localStorage` or `sessionStorage` directly for data persistence unless explicitly specified.
