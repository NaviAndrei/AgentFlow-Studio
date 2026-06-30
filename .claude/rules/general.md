---
description: General development style and dependency rules for AgentFlow Studio
paths:
  - "src/**"
---

# General Rules — AgentFlow Studio

- **Type Safety**: Strictly no `any` types. Ensure all TypeScript variables and function signatures are fully and explicitly typed.
- **Dependencies**: Do not install or introduce new `npm` dependencies without explicit approval.
- **State Persistence**: Do not use `localStorage` or `sessionStorage` directly for data persistence unless explicitly specified.
- **No Parallel Raw Fetch Paths**: Do not add raw fetch paths for LLM interaction; `callLLMDirect` must wrap `streamChat()`.
- **Merge Restrictions**: Do not merge a PR with a failing CI run.
- **Solo Development**: Work solo directly on `main` branch; do not suggest or create feature branches.
- **No Autonomous Git Operations**: Do not run `git checkout -b`, `git commit`, or `git push` autonomously. Always surface manual git commands to the user instead.

