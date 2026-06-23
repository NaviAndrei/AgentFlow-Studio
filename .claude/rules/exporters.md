---
description: Rules for LangGraph Python and build/deploy zipping exporters
paths:
  - "src/utils/codeExporter.ts"
  - "src/utils/deployExporter.ts"
---

# Exporter Rules — AgentFlow Studio

- **codeExporter `emit()` — no null args**: `emit(...added: string[])` does not accept null. Passing `null` for conditional lines fails type-check. Always use conditional statements to invoke `emit` (e.g., `if (cond) emit('...')` instead of `emit(cond ? '...' : null)`).
- **Test Compatibility**: Ensure any modifications to Python code generation logic do not break existing test assertions in `src/utils/codeExporter.test.ts`.
